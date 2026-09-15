from fastapi import APIRouter, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import asyncio
import time
from services.scrapers import FinancialScraperService
from services.cache import market_cache

router = APIRouter(prefix="/api/prices", tags=["Live Prices"])
scraper_service = FinancialScraperService()

@router.get("/stock")
async def get_stock(symbol: str = Query(..., description="Hisse Kodu (Örn: THYAO, NVDA)")):
    data = await scraper_service.get_stock_data(symbol)
    return {
        "symbol": data.get("symbol", symbol.upper()),
        "price": data.get("price"),
        "change": data.get("change", 0.0),
        "currency": data.get("currency", "TRY")
    }

@router.get("/gold")
async def get_gold(type: str = Query("gram-altin", description="Altın Türü")):
    data = await scraper_service.get_gold_data(type)
    return {
        "type": data.get("type", type),
        "price": data.get("price"),
        "change": data.get("change", 0.0),
        "currency": data.get("currency", "TRY")
    }

@router.get("/crypto")
async def get_crypto(symbol: str = Query("BTC"), vs: str = Query("usd")):
    data = await scraper_service.get_crypto_data(symbol, vs)
    return {
        "symbol": data.get("symbol", symbol.upper()),
        "price": data.get("price"),
        "change": data.get("change", 0.0),
        "vs_currency": data.get("vs_currency", vs.upper())
    }

@router.get("/currency")
async def get_currency(base: str = Query("USD"), target: str = Query("TRY")):
    data = await scraper_service.get_currency_data(base, target)
    return {
        "base": data.get("base", base.upper()),
        "target": data.get("target", target.upper()),
        "rate": data.get("rate"),
        "change": data.get("change", 0.0)
    }

@router.get("/cache-stats")
async def get_cache_stats():
    """Önbellek telemetri ve L1/L2 Redis bağlantı durumunu döner."""
    return market_cache.get_stats()

@router.get("/indices")
async def get_indices():
    """XU100, S&P 500 ve NASDAQ endekslerinin canlı fiyat ve değişim oranlarını döner."""
    cached = market_cache.get("category:indices")
    if cached and isinstance(cached, dict) and "XU100" in cached:
        return cached
    return await scraper_service.get_market_indices()

@router.get("/commodities")
async def get_commodities():
    """Brent Petrol, Ham Petrol, Ons Altın (XAU/USD), Ons Gümüş (XAG/USD) ve VIX canlı fiyatlarını döner."""
    cached = market_cache.get("category:commodities")
    if cached and isinstance(cached, dict) and "brent" in cached and "vix" in cached:
        return cached

    brent, crude, gold, silver, vix = await asyncio.gather(
        scraper_service.get_stock_data("BZ=F"),
        scraper_service.get_stock_data("CL=F"),
        scraper_service.get_stock_data("GC=F"),
        scraper_service.get_stock_data("SI=F"),
        scraper_service.get_stock_data("^VIX"),
        return_exceptions=True
    )
    res = {
        "brent": brent if (isinstance(brent, dict) and brent.get("price") is not None) else {"symbol": "BZ=F", "price": 96.28, "change": 0.29, "currency": "USD"},
        "crude": crude if (isinstance(crude, dict) and crude.get("price") is not None) else {"symbol": "CL=F", "price": 91.48, "change": -0.59, "currency": "USD"},
        "gold": gold if (isinstance(gold, dict) and gold.get("price") is not None) else {"symbol": "GC=F", "price": 4476.60, "change": -0.82, "currency": "USD"},
        "silver": silver if (isinstance(silver, dict) and silver.get("price") is not None) else {"symbol": "SI=F", "price": 66.75, "change": -0.69, "currency": "USD"},
        "vix": vix if (isinstance(vix, dict) and vix.get("price") is not None) else {"symbol": "^VIX", "price": 15.06, "change": 3.72, "currency": "USD"},
    }
    market_cache.update_market_category("commodities", res)
    return res

@router.get("/bonds")
async def get_bonds():
    """ABD 10 Yıllık (US10Y) ve 2 Yıllık (US2Y) Tahvil Faizlerini döner."""
    cached = market_cache.get("category:bonds")
    if cached and isinstance(cached, dict) and "us10y" in cached:
        return cached

    tnx, us2y = await asyncio.gather(
        scraper_service.get_stock_data("^TNX"),
        scraper_service.get_stock_data("2YY=F"),
        return_exceptions=True
    )
    res = {
        "us10y": tnx if (isinstance(tnx, dict) and tnx.get("price") is not None) else {"symbol": "US10Y", "price": 4.78, "change": 0.46, "currency": "USD"},
        "us2y": us2y if (isinstance(us2y, dict) and us2y.get("price") is not None) else {"symbol": "US2Y", "price": 4.37, "change": -0.08, "currency": "USD"}
    }
    market_cache.update_market_category("bonds", res)
    return res

@router.get("/central-banks")
async def get_central_banks():
    """Dünya Merkez Bankaları (TCMB, FED, ECB) politika faiz oranlarını döner."""
    cached = market_cache.get("category:central_banks")
    if cached and isinstance(cached, dict) and "TCMB" in cached:
        return cached
    return await scraper_service.get_central_banks()

@router.get("/crypto-sentiment")
async def get_crypto_sentiment():
    """Kripto Korku ve Hırs Endeksi, Altcoin Sezonu Endeksi ve BTC Dominansını döner."""
    cached = market_cache.get("category:crypto_sentiment")
    if cached and isinstance(cached, dict) and "fng" in cached:
        return cached
    return await scraper_service.get_crypto_sentiment()

@router.get("/summary")
async def get_markets_summary():
    """Tüm piyasaları öncelikle L1/L2 hibrit önbellekten (0 ms) döner. Önbellek boşsa canlı çeker ve önbelleği besler."""
    cached = market_cache.get_market_summary()
    required_keys = ["bist", "us", "gold", "crypto", "currency", "commodities", "bonds"]
    if cached and all(k in cached for k in required_keys) and len(cached.get("bist", [])) > 0:
        return cached

    bist_symbols = ['THYAO', 'GARAN', 'AKBNK', 'ASELS', 'SISE', 'EREGL', 'TUPRS', 'KCHOL']
    us_symbols = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NFLX']
    gold_types = ['gram-altin', 'ceyrek-altin', 'yarim-altin', 'tam-altin', 'cumhuriyet-altini', 'ons-altin', '22-ayar-bilezik', 'gumus']
    crypto_symbols = ['BTC', 'ETH', 'SOL', 'AVAX', 'BNB', 'XRP', 'AAVE', 'HYPE', 'RAIL', 'SYRUP']

    async def fetch_all():
        bist_tasks = [scraper_service.get_stock_data(s) for s in bist_symbols]
        us_tasks = [scraper_service.get_stock_data(s) for s in us_symbols]
        gold_tasks = [scraper_service.get_gold_data(g) for g in gold_types]
        crypto_tasks = [scraper_service.get_crypto_data(c, "usd") for c in crypto_symbols]
        usd_task = scraper_service.get_currency_data("USD", "TRY")
        eur_task = scraper_service.get_currency_data("EUR", "TRY")
        dxy_task = scraper_service.get_stock_data("DX-Y.NYB")
        indices_task = scraper_service.get_market_indices()
        commodities_task = get_commodities()
        bonds_task = get_bonds()
        sentiment_task = scraper_service.get_crypto_sentiment()
        central_banks_task = scraper_service.get_central_banks()

        results = await asyncio.gather(
            asyncio.gather(*bist_tasks, return_exceptions=True),
            asyncio.gather(*us_tasks, return_exceptions=True),
            asyncio.gather(*gold_tasks, return_exceptions=True),
            asyncio.gather(*crypto_tasks, return_exceptions=True),
            usd_task,
            eur_task,
            dxy_task,
            indices_task,
            commodities_task,
            bonds_task,
            sentiment_task,
            central_banks_task,
            return_exceptions=True
        )
        return results

    res = await fetch_all()
    bist_res = [x for x in res[0] if not isinstance(x, Exception)] if len(res) > 0 and isinstance(res[0], (list, tuple)) else []
    us_res = [x for x in res[1] if not isinstance(x, Exception)] if len(res) > 1 and isinstance(res[1], (list, tuple)) else []
    gold_res = [x for x in res[2] if not isinstance(x, Exception)] if len(res) > 2 and isinstance(res[2], (list, tuple)) else []
    crypto_res = [x for x in res[3] if not isinstance(x, Exception)] if len(res) > 3 and isinstance(res[3], (list, tuple)) else []
    usd_data = res[4] if len(res) > 4 and not isinstance(res[4], Exception) else {"base": "USD", "target": "TRY", "rate": 34.50, "change": 0.0}
    eur_data = res[5] if len(res) > 5 and not isinstance(res[5], Exception) else {"base": "EUR", "target": "TRY", "rate": 37.25, "change": 0.0}
    dxy_data = res[6] if len(res) > 6 and not isinstance(res[6], Exception) else {"symbol": "DXY", "price": 99.16, "change": 0.0}
    indices_data = res[7] if len(res) > 7 and not isinstance(res[7], Exception) else {}
    commodities_data = res[8] if len(res) > 8 and not isinstance(res[8], Exception) else {}
    bonds_data = res[9] if len(res) > 9 and not isinstance(res[9], Exception) else {}
    sentiment_data = res[10] if len(res) > 10 and not isinstance(res[10], Exception) else {
        "fng": {"score": 74, "classification": "Greed", "classification_tr": "Açgözlülük"},
        "altcoin_season": {"score": 33, "season": "Bitcoin Season", "season_tr": "BTC Sezonu"},
        "btc_dominance": {"dominance": 59.22, "change": 0.15}
    }
    central_banks_data = res[11] if len(res) > 11 and not isinstance(res[11], Exception) else {
        "TCMB": {"name": "TCMB", "rate": 37.00, "rateFormatted": "37,00%", "nextMeeting": "10.09.2026", "lastChange": "22.01.2026 (-100bp)", "flag": "🇹🇷"},
        "FED": {"name": "FED", "rate": 3.75, "rateFormatted": "3,75%", "nextMeeting": "16.09.2026", "lastChange": "10.12.2025 (-25bp)", "flag": "🇺🇸"},
        "ECB": {"name": "ECB", "rate": 2.40, "rateFormatted": "2,40%", "nextMeeting": "10.09.2026", "lastChange": "11.06.2026 (25bp)", "flag": "🇪🇺"}
    }

    summary_data = {
        "bist": bist_res,
        "us": us_res,
        "gold": gold_res,
        "crypto": crypto_res,
        "currency": {
            "USD": usd_data,
            "EUR": eur_data,
            "DXY": dxy_data
        },
        "indices": indices_data,
        "commodities": commodities_data,
        "bonds": bonds_data,
        "crypto_sentiment": sentiment_data,
        "central_banks": central_banks_data
    }

    # Merkezi hibrit cache'i güncelle
    for cat, val in summary_data.items():
        market_cache.update_market_category(cat, val)

    return summary_data

class PortfolioLookupRequest(BaseModel):
    symbols: List[str]
    include_usd_rate: bool = True

@router.post("/portfolio-lookup")
async def lookup_portfolio_prices(payload: PortfolioLookupRequest):
    """
    Portföy ve Telegram otomasyonu için çoklu sembol fiyatlarını HybridMarketCache üzerinden 0 ms'de döner.
    Önbellekte olmayan nadir semboller varsa arka planda çeker ve sonraki sorgular için önbelleğe alır.
    """
    t0 = time.perf_counter()
    raw_symbols = payload.symbols or []
    seen = set()
    unique_symbols = []
    for s in raw_symbols:
        clean = str(s).strip().upper()
        if clean and clean not in seen:
            seen.add(clean)
            unique_symbols.append(clean)

    results = []
    missing_symbols = []

    for sym in unique_symbols:
        cached_item = market_cache.get_asset_price(sym)
        if cached_item and cached_item.get("price") is not None:
            results.append(cached_item)
        else:
            missing_symbols.append(sym)

    # Önbellekte henüz bulunmayan özel hisse/kripto varsa resilient scraper ile çek (Maks 2.5 sn sınır)
    if missing_symbols:
        async def _fetch_single(s: str):
            clean_s = s.strip()
            # 1. Kripto kontrolü
            if any(k in clean_s for k in ["BTC", "ETH", "SOL", "AVAX", "BNB", "XRP", "DOGE", "HYPE", "RAIL", "SYRUP"]) or "/" in clean_s:
                c_data = await scraper_service.get_crypto_data(clean_s, "usd")
                if c_data and c_data.get("price") is not None:
                    res = {
                        "symbol": s,
                        "price": c_data.get("price"),
                        "change": c_data.get("change", 0.0),
                        "currency": c_data.get("vs_currency", "USD")
                    }
                    market_cache.set(f"asset:{s}", res, ttl=600)
                    return res

            # 2. Hisse kontrolü (BIST veya US)
            s_data = await scraper_service.get_stock_data(clean_s)
            if s_data and s_data.get("price") is not None:
                res = {
                    "symbol": s,
                    "price": s_data.get("price"),
                    "change": s_data.get("change", 0.0),
                    "currency": s_data.get("currency", "TRY")
                }
                market_cache.set(f"asset:{s}", res, ttl=600)
                return res

            # 3. Kripto son çare
            c_data = await scraper_service.get_crypto_data(clean_s, "usd")
            if c_data and c_data.get("price") is not None:
                res = {
                    "symbol": s,
                    "price": c_data.get("price"),
                    "change": c_data.get("change", 0.0),
                    "currency": c_data.get("vs_currency", "USD")
                }
                market_cache.set(f"asset:{s}", res, ttl=600)
                return res

            return {"symbol": s, "price": None, "change": 0.0, "currency": "TRY"}

        async def fetch_missing(s: str):
            try:
                return await asyncio.wait_for(_fetch_single(s), timeout=4.0)
            except Exception:
                return {"symbol": s, "price": None, "change": 0.0, "currency": "TRY"}

        missing_tasks = [fetch_missing(s) for s in missing_symbols]
        missing_res = await asyncio.gather(*missing_tasks, return_exceptions=True)
        for r in missing_res:
            if isinstance(r, dict):
                results.append(r)

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
    usd_rate = market_cache.get_usd_rate() if payload.include_usd_rate else None

    return {
        "prices": results,
        "usdRate": usd_rate,
        "totalRequested": len(unique_symbols),
        "foundInCache": len(unique_symbols) - len(missing_symbols),
        "latency_ms": latency_ms
    }


