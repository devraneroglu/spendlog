import pytest
import time
from services.cache import market_cache
from routers.prices import router
from fastapi import FastAPI
from fastapi.testclient import TestClient

@pytest.fixture(scope="module")
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)

def test_portfolio_lookup_mixed_assets_from_cache(client):
    # 0. Clean slate
    market_cache.clear()

    # 1. Seed categories into market_cache
    market_cache.update_market_category("crypto", [
        {"symbol": "BTC", "price": 68500.0, "change": 2.1, "vs_currency": "USD"},
        {"symbol": "ETH", "price": 3600.0, "change": -1.2, "vs_currency": "USD"}
    ])
    market_cache.update_market_category("gold", [
        {"type": "gram-altin", "price": 2980.5, "change": 0.45, "currency": "TRY"},
        {"type": "ceyrek-altin", "price": 4850.0, "change": 0.50, "currency": "TRY"},
        {"type": "ons-altin", "price": 4480.0, "change": -0.20, "currency": "USD"}
    ])
    market_cache.update_market_category("bist", [
        {"symbol": "THYAO", "price": 315.0, "change": 1.6, "currency": "TRY"},
        {"symbol": "ASELS", "price": 420.0, "change": 3.1, "currency": "TRY"}
    ])
    market_cache.update_market_category("us", [
        {"symbol": "NVDA", "price": 132.5, "change": 2.8, "currency": "USD"},
        {"symbol": "AAPL", "price": 235.0, "change": 0.5, "currency": "USD"}
    ])
    market_cache.update_market_category("currency", {
        "USD": {"base": "USD", "target": "TRY", "rate": 34.50, "change": 0.05}
    })

    # 2. Query mixed portfolio
    t0 = time.perf_counter()
    resp = client.post("/api/prices/portfolio-lookup", json={
        "symbols": ["BTC", "ETH", "ALTIN", "CEYREK", "THYAO", "ASELS", "NVDA", "USD"],
        "include_usd_rate": True
    })
    elapsed_ms = (time.perf_counter() - t0) * 1000

    assert resp.status_code == 200
    data = resp.json()

    assert data["usdRate"] == 34.50
    assert data["totalRequested"] == 8
    assert data["foundInCache"] == 8
    assert elapsed_ms < 50.0  # Should be ultra fast

    price_map = {p["symbol"]: p["price"] for p in data["prices"]}
    assert price_map["BTC"] == 68500.0
    assert price_map["ALTIN"] == 2980.5
    assert price_map["CEYREK"] == 4850.0
    assert price_map["THYAO"] == 315.0
    assert price_map["NVDA"] == 132.5
    assert price_map["USD"] == 34.50
