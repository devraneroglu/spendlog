import pytest
import time
import fakeredis
from services.cache import HybridMarketCache
from routers.prices import router
from fastapi import FastAPI
from fastapi.testclient import TestClient

@pytest.fixture
def fake_redis_client():
    return fakeredis.FakeRedis(decode_responses=True)

@pytest.fixture
def test_cache(fake_redis_client):
    return HybridMarketCache(default_ttl=60, redis_client=fake_redis_client)

def test_hybrid_market_cache_l1_and_l2(test_cache):
    # 1. Set value (writes to both L1 RAM and L2 Redis)
    test_cache.set("foo", {"price": 100})
    
    # 2. Read from L1 (instant hit)
    assert test_cache.get("foo") == {"price": 100}

    # 3. Evict L1 RAM, verify L1 is empty
    test_cache._l1_cache.clear()
    assert len(test_cache._l1_cache) == 0

    # 4. Read from L2 Redis (hit from Redis, re-hydrates L1)
    val = test_cache.get("foo")
    assert val == {"price": 100}
    
    # 5. Verify value is re-hydrated into L1 RAM
    assert "foo" in test_cache._l1_cache

def test_safe_fallback_when_redis_offline():
    # Simulate completely offline / invalid Redis
    bad_cache = HybridMarketCache(default_ttl=60)
    # Even if Redis is offline, L1 RAM should work flawlessly without errors
    bad_cache.set("offline_test", {"status": "ok"})
    assert bad_cache.get("offline_test") == {"status": "ok"}
    stats = bad_cache.get_stats()
    assert stats["l1_items_count"] >= 1
    assert "is_redis_connected" in stats

def test_summary_cache_update_and_get(test_cache):
    test_cache.update_market_category("bist", [{"symbol": "THYAO", "price": 310.0}])
    test_cache.update_market_category("crypto", [{"symbol": "BTC", "price": 60000.0}])

    summary = test_cache.get_market_summary()
    assert summary is not None
    assert "bist" in summary
    assert "crypto" in summary
    assert summary["bist"][0]["symbol"] == "THYAO"

def test_cache_telemetry_stats(test_cache):
    test_cache.set("sample_stat", {"val": 42})
    stats = test_cache.get_stats()
    assert stats["l1_items_count"] >= 1
    assert stats["is_redis_connected"] is True
    assert stats["l1_default_ttl"] == 60

def test_api_summary_returns_cached_instantaneously():
    from services.cache import market_cache
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    sample = {
        "bist": [{"symbol": "THYAO", "price": 310.0, "change": 1.5, "currency": "TRY"}],
        "us": [{"symbol": "NVDA", "price": 130.0, "change": 2.0, "currency": "USD"}],
        "gold": [{"type": "gram-altin", "price": 2950.0, "change": 0.5, "currency": "TRY"}],
        "crypto": [{"symbol": "BTC", "price": 65000.0, "change": 1.2, "vs_currency": "USD"}],
        "currency": {
            "USD": {"base": "USD", "target": "TRY", "rate": 34.50, "change": 0.1},
            "EUR": {"base": "EUR", "target": "TRY", "rate": 37.25, "change": -0.2},
            "DXY": {"symbol": "DXY", "price": 99.16, "change": 0.05}
        },
        "commodities": {
            "brent": {"symbol": "BZ=F", "price": 96.28, "change": 0.29, "currency": "USD"},
            "crude": {"symbol": "CL=F", "price": 91.48, "change": -0.59, "currency": "USD"},
            "gold": {"symbol": "GC=F", "price": 4476.60, "change": -0.82, "currency": "USD"},
            "silver": {"symbol": "SI=F", "price": 66.75, "change": -0.69, "currency": "USD"},
            "vix": {"symbol": "^VIX", "price": 15.06, "change": 3.72, "currency": "USD"},
        },
        "bonds": {
            "us10y": {"symbol": "US10Y", "price": 4.78, "change": 0.46, "currency": "USD"},
            "us2y": {"symbol": "US2Y", "price": 4.37, "change": -0.08, "currency": "USD"},
        },
        "crypto_sentiment": {
            "fng": {"score": 74, "classification": "Greed", "classification_tr": "Açgözlülük"},
            "altcoin_season": {"score": 33, "season": "Bitcoin Season", "season_tr": "BTC Sezonu"},
            "btc_dominance": {"dominance": 59.22, "change": 0.15}
        },
        "central_banks": {
            "TCMB": {"name": "TCMB", "rate": 37.00, "rateFormatted": "37,00%", "nextMeeting": "10.09.2026", "lastChange": "22.01.2026 (-100bp)", "flag": "🇹🇷"}
        }
    }
    for cat, val in sample.items():
        market_cache.update_market_category(cat, val)

    t0 = time.perf_counter()
    resp = client.get("/api/prices/summary")
    duration = (time.perf_counter() - t0) * 1000

    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["bist"][0]["symbol"] == "THYAO"
    assert res_data["commodities"]["vix"]["price"] == 15.06
    assert res_data["bonds"]["us2y"]["price"] == 4.37
    assert duration < 100.0

def test_indices_sectors_summary():
    from services.cache import market_cache
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    indices_payload = {
        "XU100": {"symbol": "XU100", "price": 14127.89, "change": 0.82, "currency": "TRY"},
        "SP500": {"symbol": "^GSPC", "price": 7718.60, "change": -0.38, "currency": "USD"},
        "NASDAQ": {"symbol": "^IXIC", "price": 26506.99, "change": -0.29, "currency": "USD"},
        "sectors": {
            "XBANK": {"symbol": "XBANK", "price": 16653.08, "change": 0.25, "currency": "TRY"},
            "XHOLD": {"symbol": "XHOLD", "price": 14461.68, "change": 0.36, "currency": "TRY"},
            "XUSIN": {"symbol": "XUSIN", "price": 19470.92, "change": 1.25, "currency": "TRY"},
            "XULAS": {"symbol": "XULAS", "price": 36081.85, "change": -0.81, "currency": "TRY"},
            "XGMYO": {"symbol": "XGMYO", "price": 6126.32, "change": -1.21, "currency": "TRY"},
        }
    }
    market_cache.update_market_category("indices", indices_payload)

    resp = client.get("/api/prices/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "indices" in data
    assert data["indices"]["XU100"]["price"] == 14127.89
    assert "sectors" in data["indices"]
    assert data["indices"]["sectors"]["XBANK"]["price"] == 16653.08
    assert data["indices"]["sectors"]["XUSIN"]["change"] == 1.25
