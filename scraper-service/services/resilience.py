import asyncio
from typing import Callable, Any, Optional, Dict
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential_jitter,
    retry_if_exception_type,
    before_sleep_log,
)
import httpx
from services.logger import scraper_logger
from services.alert_service import scraper_alert_service

# Ağ ve Geçici HTTP Hata Tipleri
RETRYABLE_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.NetworkError,
    httpx.RemoteProtocolError,
    ConnectionError,
    TimeoutError,
)

def async_retry_with_backoff(
    max_attempts: int = 3,
    min_wait: float = 0.5,
    max_wait: float = 4.0,
    jitter: float = 0.5,
    operation_name: str = "Scraper İstek"
):
    """
    SpendLog V2 — Tenacity Tabanlı Asenkron Exponential Backoff & Jitter Yeniden Deneme Dekoratörü.
    Geçici ağ kopmaları, timeout ve sunucu tıkanmalarında katlanarak artan aralıklarla otomatik dener.
    """
    def decorator(func: Callable):
        @retry(
            reraise=True,
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential_jitter(initial=min_wait, max=max_wait, jitter=jitter),
            retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
        )
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except RETRYABLE_EXCEPTIONS as err:
                scraper_logger.warning(f"⚠️ [{operation_name}] Geçici ağ hatası: {err}. Backoff ile yeniden deneniyor...")
                raise err
            except Exception as unhandled:
                if hasattr(unhandled, "response") and getattr(unhandled.response, "status_code", None) == 429:
                    scraper_logger.warning(f"⚠️ [{operation_name}] HTTP 429 (Rate Limit). Backoff ile deneniyor...")
                    raise unhandled
                raise unhandled
        return wrapper
    return decorator

async def safe_http_get(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 5.0,
    max_attempts: int = 3,
    follow_redirects: bool = True,
    **kwargs
) -> Optional[httpx.Response]:
    """
    SpendLog V2 — Merkezi Zırhlı HTTP GET İstemcisi.
    Otomatik Header Rotasyonu + Tenacity Exponential Backoff & Jitter + HTTP 429 Koruma Kalkanı.
    """
    from services.headers import HeaderRotator
    req_headers = headers or HeaderRotator.get_random_headers()

    @retry(
        reraise=True,
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential_jitter(initial=0.5, max=3.5, jitter=0.5),
        retry=retry_if_exception_type(RETRYABLE_EXCEPTIONS),
    )
    async def _fetch():
        async with httpx.AsyncClient(headers=req_headers, timeout=timeout, follow_redirects=follow_redirects) as client:
            resp = await client.get(url, **kwargs)
            if resp.status_code == 429:
                scraper_logger.warning(f"⚠️ [HTTP 429] {url} - Rate limit aşıldı, backoff ile bekleniyor...")
                raise httpx.NetworkError(f"HTTP 429 Rate Limit on {url}")
            return resp

    try:
        return await _fetch()
    except Exception as e:
        scraper_logger.debug(f"[safe_http_get failed after {max_attempts} attempts] {url}: {e}")
        return None

async def report_selector_failure(source_name: str, target_field: str, raw_snippet: str = None):
    """
    Kırılgan Seçici Alarmı (Selector Telemetry):
    DOM yapısı değiştiğinde veya beklenen seçici boş veri döndürdüğünde anında alarm üretir.
    """
    msg = f"Kırılgan Seçici Hatası: '{source_name}' kaynağından '{target_field}' alanı çekilemedi. Sayfa yapısı değişmiş olabilir."
    scraper_logger.error(f"[SELECTOR FAILURE] {msg} | Snippet: {raw_snippet[:120] if raw_snippet else 'Yok'}")
    try:
        asyncio.create_task(
            scraper_alert_service.send_scraper_alert(
                job_name=f"Selector Alarm: {source_name}",
                error_message=f"{msg} (DOM Güncellemesi Gerekebilir)"
            )
        )
    except Exception:
        pass
