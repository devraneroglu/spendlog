import asyncio
from typing import Dict
from aiolimiter import AsyncLimiter
from urllib.parse import urlparse

class HostThrottler:
    """
    SpendLog V2 — Host Bazlı Token Bucket Hız Sınırlayıcı (Request Throttler).
    Her dış sağlayıcı (Yahoo, BigPara, CNBC, CoinGecko) için saniyede azami 
    istek sınırını (rate limit) denetler ve HTTP 429 / WAF engellerini önler.
    """
    def __init__(self, default_rate: int = 8, time_period: float = 1.0):
        self.default_rate = default_rate
        self.time_period = time_period
        self._limiters: Dict[str, AsyncLimiter] = {
            "query1.finance.yahoo.com": AsyncLimiter(10, 1.0),
            "query2.finance.yahoo.com": AsyncLimiter(10, 1.0),
            "bigpara.hurriyet.com.tr": AsyncLimiter(10, 1.0),
            "quote.cnbc.com": AsyncLimiter(6, 1.0),
            "api.coingecko.com": AsyncLimiter(4, 1.0),
            "api.binance.com": AsyncLimiter(15, 1.0),
            "scanner.tradingview.com": AsyncLimiter(15, 1.0),
            "www.investing.com": AsyncLimiter(4, 1.0),
        }
        self._lock = asyncio.Lock()

    async def acquire(self, url: str):
        """URL'den host adını çıkarıp ilgili hız sınırlayıcıdan izin alır."""
        try:
            parsed = urlparse(url)
            host = parsed.netloc.lower().split(':')[0]
        except Exception:
            host = "default"

        async with self._lock:
            if host not in self._limiters:
                self._limiters[host] = AsyncLimiter(self.default_rate, self.time_period)
            limiter = self._limiters[host]

        await limiter.acquire()

host_throttler = HostThrottler()
