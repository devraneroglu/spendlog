import pytest
import asyncio
from decimal import Decimal
from services.sanitizer import DataSanitizer
from services.headers import HeaderRotator
from services.resilience import async_retry_with_backoff, safe_http_get

class TestDataSanitizerContract:
    """Merkezi Veri Temizleme (DataSanitizer) Sözleşme Testleri"""

    def test_clean_text_mojibake(self):
        corrupted = "TÃ¼rkiye Ä°Ã§in BIST 100 & AltÄ±n FiyatlarÄ±"
        fixed = DataSanitizer.clean_text(corrupted)
        assert "Türkiye" in fixed
        assert "İçin" in fixed
        assert "Altın" in fixed
        assert "Fiyatları" in fixed

    def test_to_float_turkish_format(self):
        assert DataSanitizer.to_float("1.250,50 TL") == 1250.50
        assert DataSanitizer.to_float("₺ 14.012,42") == 14012.42
        assert DataSanitizer.to_float("6.898,85 ₺") == 6898.85
        assert DataSanitizer.to_float("37,00 %") == 37.0

    def test_to_float_us_format(self):
        assert DataSanitizer.to_float("$ 4,477.20") == 4477.20
        assert DataSanitizer.to_float("95.83") == 95.83
        assert DataSanitizer.to_float("$91.22") == 91.22

    def test_extract_change_percent(self):
        assert DataSanitizer.extract_change_percent("+1,45%") == 1.45
        assert DataSanitizer.extract_change_percent("-0,09%") == -0.09
        assert DataSanitizer.extract_change_percent("▲ 0,15%") == 0.15
        assert DataSanitizer.extract_change_percent(None) == 0.0

    def test_to_decimal_precision(self):
        dec = DataSanitizer.to_decimal("1.250,50 ₺")
        assert isinstance(dec, Decimal)
        assert dec == Decimal("1250.5")

    def test_safe_fallbacks(self):
        assert DataSanitizer.to_float(None, default=99.9) == 99.9
        assert DataSanitizer.to_float("gecersiz", default=0.0) == 0.0
        assert DataSanitizer.clean_text(None) == ""


class TestHeaderRotatorContract:
    """Tarayıcı Kimlik (HeaderRotator) Sözleşme Testleri"""

    def test_header_structure(self):
        headers = HeaderRotator.get_random_headers()
        assert "User-Agent" in headers
        assert "Accept" in headers
        assert "Accept-Language" in headers
        assert "tr-TR" in headers["Accept-Language"]

    def test_user_agent_diversity(self):
        agents = {HeaderRotator.get_random_headers()["User-Agent"] for _ in range(20)}
        # En az 2 farklı tarayıcı profili üretilmeli
        assert len(agents) >= 2


class TestResilienceContract:
    """Ağ Dayanıklılığı (Resilience & Retry) Sözleşme Testleri"""

    @pytest.mark.asyncio
    async def test_retry_on_intermittent_error(self):
        attempts = 0

        @async_retry_with_backoff(max_attempts=3, min_wait=0.05, max_wait=0.2, jitter=0.01)
        async def flaky_call():
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                import httpx
                raise httpx.ConnectTimeout("Geçici zaman aşımı")
            return "SUCCESS"

        result = await flaky_call()
        assert result == "SUCCESS"
        assert attempts == 3

    @pytest.mark.asyncio
    async def test_safe_http_get_graceful_failure(self):
        # Geçersiz bir adreste patlamadan None dönmeli
        res = await safe_http_get("http://localhost:9999/nonexistent-endpoint", timeout=0.2, max_attempts=1)
        assert res is None


class TestScraperServiceContract:
    """Finansal Kazıyıcı Servis Çıktı Şeması Sözleşme Testleri"""

    @pytest.mark.asyncio
    async def test_crypto_sentiment_contract(self):
        from services.scrapers import FinancialScraperService
        service = FinancialScraperService()
        sentiment = await service.get_crypto_sentiment()
        assert "fng" in sentiment
        assert "altcoin_season" in sentiment
        assert "btc_dominance" in sentiment
        assert isinstance(sentiment["fng"]["score"], int)
        assert 0 <= sentiment["fng"]["score"] <= 100
        assert isinstance(sentiment["altcoin_season"]["score"], int)
        assert isinstance(sentiment["btc_dominance"]["dominance"], (int, float))

    @pytest.mark.asyncio
    async def test_central_banks_contract(self):
        from services.scrapers import FinancialScraperService
        service = FinancialScraperService()
        cb = await service.get_central_banks()
        for bank in ["TCMB", "FED", "ECB"]:
            assert bank in cb
            assert "rate" in cb[bank]
            assert isinstance(cb[bank]["rate"], (int, float))
            assert cb[bank]["rate"] > 0

