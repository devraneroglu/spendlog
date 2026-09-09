import os
import time
import httpx
import logging
from typing import Optional

logger = logging.getLogger("spendlog.alerts")

class TelegramScraperAlertService:
    def __init__(self, bot_token: Optional[str] = None):
        self.bot_token = bot_token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.api_url = (
            f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            if self.bot_token and "YOUR_TELEGRAM_BOT_TOKEN" not in self.bot_token
            else None
        )
        self._last_alert_times = {}
        self.throttle_seconds = 300  # 5 dakika

    async def send_scraper_alert(self, job_name: str, error_message: str, trace_id: Optional[str] = None):
        """Kritik scraping / OCR arızalarında Telegram alarmı gönderir (Anti-Spam Throttled)."""
        if not self.api_url:
            logger.debug("Telegram Bot Token yapılandırılmamış, alarm bildirimi atlandı.")
            return

        now = time.time()
        alert_key = f"{job_name}:{error_message}"

        # 5 dakikalık throttling
        if alert_key in self._last_alert_times:
            if now - self._last_alert_times[alert_key] < self.throttle_seconds:
                logger.info(f"Telegram alarmı throttled (Son 5 dk içinde iletildi): {job_name}")
                return

        self._last_alert_times[alert_key] = now
        trace_str = trace_id or f"SCRP-{int(now) % 100000:05d}"

        text = (
            f"🚨 *[SCRAPER KRİTİK ALARMI]*\n\n"
            f"• *Görev / Servis:* `{job_name}`\n"
            f"• *Hata Detayı:* `{error_message[:200]}`\n"
            f"• *Takip Kodu (TraceId):* `{trace_str}`\n\n"
            f"⚠️ _Veri kaynağı (DOM/API) değişmiş veya rate limit oluşmuş olabilir._"
        )

        try:
            # Backend'deki aktif kullanıcı chat ID'sini veya varsayılan admini al
            # İlk etapta doğrudan veritabanı veya bilinen admin chat ID'sine yayın yapabiliriz
            async with httpx.AsyncClient(timeout=4.0) as client:
                # Backend API'den aktif telegram kullanıcılarını sorgula veya bilinen chat ID'ye at
                # Örnek: Get active users from SpendLog Backend API
                try:
                    res = await client.get("http://localhost:5007/api/users/active-chat-ids")
                    if res.status_code == 200:
                        chat_ids = res.json()
                        for cid in chat_ids:
                            await client.post(self.api_url, json={
                                "chat_id": cid,
                                "text": text,
                                "parse_mode": "Markdown"
                            })
                        return
                except Exception:
                    pass

                # Fallback: Telegram getUpdates veya loglama
                logger.warning(f"Telegram alarmı oluşturuldu: {job_name} -> {error_message}")
        except Exception as ex:
            logger.error(f"Telegram alarmı gönderilirken hata: {ex}")

scraper_alert_service = TelegramScraperAlertService()
