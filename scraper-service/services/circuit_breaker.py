import time
import asyncio
from enum import Enum
from typing import Callable, Any, Dict, Optional
from services.logger import scraper_logger

class CircuitState(Enum):
    CLOSED = "CLOSED"         # Normal: İstekler birincil servise gider
    OPEN = "OPEN"             # Devre Açık: Birincil servis bloke, doğrudan fallback
    HALF_OPEN = "HALF_OPEN"   # Yarı Açık: Deneme isteği atılır

class CircuitBreaker:
    """
    SpendLog V2 — Asenkron Devre Kesici (Circuit Breaker).
    Dış kaynak üst üste hata verdiğinde devreyi açarak sunucuyu gereksiz 
    yükten korur ve anında ikincil fallback kaynağa yönlendirir.
    """
    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
        half_open_success_threshold: int = 1
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.half_open_success_threshold = half_open_success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_state_change = time.time()
        self._lock = asyncio.Lock()

    async def call(self, primary_func: Callable, fallback_func: Optional[Callable] = None, *args, **kwargs) -> Any:
        async with self._lock:
            now = time.time()
            if self.state == CircuitState.OPEN:
                if now - self.last_state_change > self.reset_timeout:
                    self.state = CircuitState.HALF_OPEN
                    self.last_state_change = now
                    scraper_logger.info(f"⚡ [CIRCUIT BREAKER] {self.name}: OPEN -> HALF_OPEN (Test isteği deneniyor)")
                else:
                    if fallback_func:
                        return await fallback_func(*args, **kwargs)
                    raise RuntimeError(f"Circuit {self.name} is OPEN and no fallback provided.")

        try:
            result = await primary_func(*args, **kwargs)

            # Sonuç None veya açıkça hatalı mı?
            if result is None:
                raise ValueError("Primary function returned None")

            async with self._lock:
                if self.state == CircuitState.HALF_OPEN:
                    self.success_count += 1
                    if self.success_count >= self.half_open_success_threshold:
                        self.state = CircuitState.CLOSED
                        self.failure_count = 0
                        self.success_count = 0
                        self.last_state_change = time.time()
                        scraper_logger.info(f"✅ [CIRCUIT BREAKER] {self.name}: HALF_OPEN -> CLOSED (Servis normale döndü)")
                elif self.state == CircuitState.CLOSED:
                    self.failure_count = 0

            return result
        except Exception as e:
            async with self._lock:
                self.failure_count += 1
                scraper_logger.warning(f"⚠️ [CIRCUIT BREAKER] {self.name} hata aldı ({self.failure_count}/{self.failure_threshold}): {e}")

                if self.state in (CircuitState.CLOSED, CircuitState.HALF_OPEN) and self.failure_count >= self.failure_threshold:
                    self.state = CircuitState.OPEN
                    self.last_state_change = time.time()
                    scraper_logger.error(f"🚨 [CIRCUIT BREAKER] {self.name}: Devre AÇILDI (OPEN). {self.reset_timeout}s boyunca fallback kullanılacak.")

            if fallback_func:
                return await fallback_func(*args, **kwargs)
            raise

class CircuitBreakerRegistry:
    def __init__(self):
        self._breakers: Dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()

    async def get(self, name: str, failure_threshold: int = 3, reset_timeout: float = 60.0) -> CircuitBreaker:
        async with self._lock:
            if name not in self._breakers:
                self._breakers[name] = CircuitBreaker(name, failure_threshold, reset_timeout)
            return self._breakers[name]

circuit_registry = CircuitBreakerRegistry()
