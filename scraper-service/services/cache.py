import os
import time
import json
from typing import Dict, Any, Optional
from cachetools import TTLCache
import redis
from services.logger import scraper_logger

class HybridMarketCache:
    """
    SpendLog V2 — Çok Katmanlı Dağıtık Finansal Önbellek Motoru (Multi-Tier Caching).
    L1 (RAM): cachetools.TTLCache (Mikro-saniyelik in-process erişim)
    L2 (Redis): redis.Redis (Mikroservisler arası paylaşılan, dağıtık ve kalıcı L2 önbellek)
    Safe Fallback: Redis bağlantısı kopsa veya offline olsa bile L1 RAM ile kesintisiz çalışır.
    """
    def __init__(
        self,
        cache_dir: str = ".cache_data",
        default_ttl: int = 300,
        redis_client: Optional[redis.Redis] = None,
        key_prefix: str = "spendlog:"
    ):
        self.default_ttl = default_ttl
        self.key_prefix = key_prefix
        
        # L1: Bellek İçi TTL Cache (1000 anahtar, varsayılan 300 sn)
        self._l1_cache: TTLCache = TTLCache(maxsize=1000, ttl=default_ttl)

        # L2: Dağıtık Redis İstemcisi
        self._redis_host = os.getenv("REDIS_HOST", "localhost")
        self._redis_port = int(os.getenv("REDIS_PORT", 6379))
        self._redis_db = int(os.getenv("REDIS_DB", 0))
        self._redis_password = os.getenv("REDIS_PASSWORD", None)

        self._is_redis_available = False
        self._last_redis_check_time = 0.0

        if redis_client is not None:
            self._redis = redis_client
            self._check_redis_connection(initial=True)
        else:
            try:
                pool = redis.ConnectionPool(
                    host=self._redis_host,
                    port=self._redis_port,
                    db=self._redis_db,
                    password=self._redis_password,
                    decode_responses=True,
                    protocol=2,
                    socket_connect_timeout=2.0,
                    socket_timeout=2.0
                )
                self._redis = redis.Redis(connection_pool=pool)
                self._check_redis_connection(initial=True)
            except Exception as e:
                self._redis = None
                self._is_redis_available = False
                scraper_logger.warning(
                    f"⚠️ [CACHE ENGINE] Redis havuzu oluşturulamadı ({self._redis_host}:{self._redis_port}): {e}. "
                    "L1 RAM modunda çalışılacak."
                )

    def _format_key(self, key: str) -> str:
        """Anahtar ismini standart spendlog prefix'i ile formatlar."""
        if key.startswith(self.key_prefix):
            return key
        return f"{self.key_prefix}{key}"

    def _check_redis_connection(self, initial: bool = False) -> bool:
        """Redis'in erişilebilirliğini test eder."""
        if not self._redis:
            self._is_redis_available = False
            return False

        try:
            self._redis.ping()
            if not self._is_redis_available:
                scraper_logger.info(f"💾 [CACHE ENGINE] L2 Dağıtık Redis bağlantısı sağlandı: {self._redis_host}:{self._redis_port}")
            self._is_redis_available = True
            return True
        except Exception as e:
            if self._is_redis_available or initial:
                scraper_logger.warning(
                    f"⚠️ [CACHE ENGINE] Redis erişilemiyor ({self._redis_host}:{self._redis_port}): {e}. "
                    "L1 In-Process RAM moduna geçildi (Safe Fallback)."
                )
            self._is_redis_available = False
            self._last_redis_check_time = time.time()
            return False

    def is_redis_connected(self) -> bool:
        """Redis'in anlık bağlantı durumunu döner (periyodik kontrol desteğiyle)."""
        now = time.time()
        # Eğer offline ise her 30 saniyede bir yeniden bağlanmayı dene
        if not self._is_redis_available and (now - self._last_redis_check_time > 30):
            return self._check_redis_connection()
        return self._is_redis_available

    def get(self, key: str) -> Optional[Any]:
        """
        Önce L1 (RAM), yoksa L2 (Redis)'den veriyi getirir.
        L2'de bulunursa L1'e geri besler (hydrate).
        """
        # 1. L1 In-Process RAM kontrolü (< 0.05 ms)
        if key in self._l1_cache:
            return self._l1_cache[key]

        # 2. L2 Dağıtık Redis kontrolü (~1 ms)
        if self.is_redis_connected() and self._redis:
            try:
                redis_key = self._format_key(key)
                val = self._redis.get(redis_key)
                if val is not None:
                    # Deserialization
                    try:
                        parsed = json.loads(val)
                    except (json.JSONDecodeError, TypeError):
                        parsed = val
                    
                    # L1'e geri besle
                    self._l1_cache[key] = parsed
                    return parsed
            except Exception as e:
                scraper_logger.debug(f"L2 Redis read error for {key}: {e}")
                self._is_redis_available = False
                self._last_redis_check_time = time.time()

        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Veriyi hem L1 (RAM) hem L2 (Redis)'e yazar."""
        expire = ttl or self.default_ttl
        
        # 1. L1 RAM yazma
        self._l1_cache[key] = value

        # 2. L2 Redis yazma
        if self.is_redis_connected() and self._redis:
            try:
                redis_key = self._format_key(key)
                serialized = json.dumps(value, ensure_ascii=False)
                self._redis.set(redis_key, serialized, ex=expire)
            except Exception as e:
                scraper_logger.debug(f"L2 Redis write error for {key}: {e}")
                self._is_redis_available = False
                self._last_redis_check_time = time.time()

    def clear(self):
        """Tüm önbelleği temizler (L1 RAM ve L2 Redis anahtarları)."""
        self._l1_cache.clear()
        if self.is_redis_connected() and self._redis:
            try:
                # Sadece spendlog:* anahtarlarını tara ve sil (diğer Redis verilerine dokunmaz)
                pattern = f"{self.key_prefix}*"
                cursor = 0
                while True:
                    cursor, keys = self._redis.scan(cursor=cursor, match=pattern, count=100)
                    if keys:
                        self._redis.delete(*keys)
                    if cursor == 0:
                        break
            except Exception as e:
                scraper_logger.debug(f"L2 Redis clear error: {e}")

    # ==================== PİYASA ÖZETİ & PORTFÖY YÖNETİMİ ====================

    def update_market_category(self, category: str, data: Any):
        """Kategori bazlı piyasa verisini günceller ve merkezi summary'ye işler."""
        self.set(f"category:{category}", data, ttl=600)

        # Merkezi summary nesnesini güncelle
        summary = self.get("market:summary") or {}
        summary[category] = data
        summary["last_updated_at"] = time.time()
        self.set("market:summary", summary, ttl=600)

    def update_market_categories(self, categories: Dict[str, Any]):
        """Birden çok kategori verisini tek seferde günceller ve merkezi summary'yi atomik işler."""
        summary = self.get("market:summary") or {}
        for category, data in categories.items():
            self.set(f"category:{category}", data, ttl=600)
            summary[category] = data
        summary["last_updated_at"] = time.time()
        self.set("market:summary", summary, ttl=600)

    def get_market_summary(self) -> Optional[Dict[str, Any]]:
        """Zamanlayıcının doldurduğu merkezi piyasa özetini döner."""
        return self.get("market:summary")

    def get_usd_rate(self) -> float:
        """Önbellekteki güncel USD/TRY kurunu döner."""
        curr = self.get("category:currency") or {}
        usd_item = curr.get("USD")
        if isinstance(usd_item, dict):
            return float(usd_item.get("rate") or 48.82)
        return float(usd_item or 48.82)

    def get_asset_price(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Portföy ve Telegram otomasyonu için sembol bazında önbellekten anlık fiyat döner.
        Kripto, Altın/Emtia, BIST, US Hisseleri ve Döviz kurlarını akıllıca çözer.
        """
        if not symbol:
            return None

        raw = symbol.upper().strip()
        clean = raw.replace("/USDT", "").replace("/USD", "").replace("/TRY", "").replace("USDT", "").replace("USD", "").replace("/TL", "").strip()
        
        # Türkçe karakter ve ayraç normalizasyonu (Örn: "GRAM ALTIN" -> "GRAMALTIN")
        tr_map = str.maketrans("İıĞğÜüŞşÖöÇç", "IIGGUUSSÖÖCC")
        norm = raw.translate(tr_map).replace(" ", "").replace("-", "").replace("_", "").replace(".", "").strip()

        # 0. Özel tekil önbellek kontrolü (önceki cache-miss aramaları)
        cached_direct = self.get(f"asset:{raw}") or self.get(f"asset:{clean}") or self.get(f"asset:{norm}")
        if cached_direct:
            return cached_direct

        # 1. Döviz Kurları
        if raw in ["USD", "USDTRY", "USD/TRY", "DOLAR"] or norm in ["USD", "USDTRY", "DOLAR"]:
            curr = self.get("category:currency") or {}
            usd = curr.get("USD")
            rate = usd.get("rate", 48.82) if isinstance(usd, dict) else (usd or 48.82)
            chg = usd.get("change", 0.0) if isinstance(usd, dict) else 0.0
            return {"symbol": raw, "price": rate, "change": chg, "currency": "TRY"}
        if raw in ["EUR", "EURTRY", "EUR/TRY", "EURO"] or norm in ["EUR", "EURTRY", "EURO"]:
            curr = self.get("category:currency") or {}
            eur = curr.get("EUR")
            rate = eur.get("rate", 55.95) if isinstance(eur, dict) else (eur or 55.95)
            chg = eur.get("change", 0.0) if isinstance(eur, dict) else 0.0
            return {"symbol": raw, "price": rate, "change": chg, "currency": "TRY"}

        # 2. Altın & Kıymetli Madenler (BigPara & Emtia)
        gold_list = self.get("category:gold") or []

        # Ons Altın / Gümüş (USD bazlı)
        if any(k in norm for k in ["ONSALTIN", "XAUUSD"]) or norm in ["ONS", "XAU"]:
            comm = self.get("category:commodities") or {}
            gold_ons = comm.get("gold")
            if isinstance(gold_ons, dict) and gold_ons.get("price"):
                return {"symbol": raw, "price": gold_ons.get("price"), "change": gold_ons.get("change", 0.0), "currency": "USD"}
            for g in gold_list:
                if g.get("type") == "ons-altin":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "USD"}

        elif any(k in norm for k in ["ONSGUMUS", "XAGUSD"]) or norm in ["XAG"]:
            comm = self.get("category:commodities") or {}
            silv_ons = comm.get("silver")
            if isinstance(silv_ons, dict) and silv_ons.get("price"):
                return {"symbol": raw, "price": silv_ons.get("price"), "change": silv_ons.get("change", 0.0), "currency": "USD"}
            for g in gold_list:
                if g.get("type") == "gumus":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "USD"}

        elif "CEYREK" in norm:
            for g in gold_list:
                if g.get("type") == "ceyrek-altin":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif "YARIM" in norm:
            for g in gold_list:
                if g.get("type") == "yarim-altin":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif "TAM" in norm:
            for g in gold_list:
                if g.get("type") == "tam-altin":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif any(k in norm for k in ["CUMHURIYET", "ATA"]):
            for g in gold_list:
                if g.get("type") == "cumhuriyet-altini":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif any(k in norm for k in ["BILEZIK", "22AYAR"]):
            for g in gold_list:
                if g.get("type") == "22-ayar-bilezik":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif "GUMUS" in norm or "SILVER" in norm:
            for g in gold_list:
                if g.get("type") == "gumus":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        elif any(k in norm for k in ["GRAM", "ALTIN", "GLD", "GA"]):
            for g in gold_list:
                if g.get("type") == "gram-altin":
                    return {"symbol": raw, "price": g.get("price"), "change": g.get("change", 0.0), "currency": "TRY"}

        # 3. Kripto Paralar (Binance & CoinGecko)
        for c in (self.get("category:crypto") or []):
            c_sym = c.get("symbol", "").upper().strip()
            if c_sym in [raw, clean, norm]:
                is_try = raw.endswith("/TRY") or raw.endswith("/TL") or raw.endswith("TRY") or raw.endswith("TL")
                price = c.get("price")
                if is_try and c.get("vs_currency") == "USD" and price:
                    usd_rate = self.get_usd_rate()
                    price = round(price * usd_rate, 2)
                return {
                    "symbol": raw,
                    "price": price,
                    "change": c.get("change", 0.0),
                    "currency": "TRY" if is_try else c.get("vs_currency", "USD")
                }

        # 4. BIST Hisseleri
        for b in (self.get("category:bist") or []):
            b_sym = b.get("symbol", "").upper().replace(".IS", "").strip()
            if b_sym in [raw, clean, norm, raw.replace(".IS", "")]:
                return {
                    "symbol": raw,
                    "price": b.get("price"),
                    "change": b.get("change", 0.0),
                    "currency": "TRY"
                }

        # 5. ABD Hisseleri (S&P 500 / NASDAQ)
        for u in (self.get("category:us") or []):
            u_sym = u.get("symbol", "").upper().strip()
            if u_sym in [raw, clean, norm]:
                return {
                    "symbol": raw,
                    "price": u.get("price"),
                    "change": u.get("change", 0.0),
                    "currency": "USD"
                }

        return None

    def get_stats(self) -> Dict[str, Any]:
        """Önbellek telemetri istatistiklerini döner."""
        return {
            "l1_items_count": len(self._l1_cache),
            "l1_max_size": self._l1_cache.maxsize,
            "l1_default_ttl": self.default_ttl,
            "is_redis_connected": self.is_redis_connected(),
            "redis_host": f"{self._redis_host}:{self._redis_port}",
            "redis_db": self._redis_db,
            "key_prefix": self.key_prefix
        }

market_cache = HybridMarketCache()
