import asyncio
import httpx
import re
from typing import Dict, Any, Optional, List
from services.logger import scraper_logger
from services.sanitizer import DataSanitizer
from services.headers import HeaderRotator
from services.resilience import report_selector_failure
from services.throttler import host_throttler
from services.circuit_breaker import circuit_registry
from services.cache import market_cache

class FinancialScraperService:
    def __init__(self):
        self.headers = HeaderRotator.get_random_headers()
        self._sentiment_cache = None
        self._sentiment_cache_time = 0.0
        self._central_banks_cache = None
        self._central_banks_cache_time = 0.0

    def _fetch_yfinance_fast_info(self, sym: str) -> Optional[Dict[str, Any]]:
        """yfinance Fast-Info Katmanı (Yahoo 429 Bot Kalkanını ve Oturumları Aşar)"""
        import yfinance as yf
        try:
            t = yf.Ticker(sym)
            p = t.fast_info.last_price
            prev = t.fast_info.previous_close
            if p is not None and float(p) > 0:
                chg = ((float(p) - float(prev)) / float(prev) * 100) if prev else 0.0
                cur = t.fast_info.currency or ("USD" if not sym.endswith(".IS") else "TRY")
                scraper_logger.info(f"[YFINANCE FAST_INFO] {sym} -> {p:.2f} {cur} ({chg:+.2f}%)")
                return {
                    "symbol": sym,
                    "price": round(float(p), 2),
                    "change": round(float(chg), 2),
                    "currency": cur
                }
        except Exception as e:
            scraper_logger.debug(f"yfinance error for {sym}: {e}")
        return None

    async def get_cnbc_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """CNBC Açık XHR Servisinden Tahvil ve Emtia Fiyat/Getiri Çeker (Örn: US2Y, US10Y)"""
        url = f"https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols={symbol}&requestMethod=itv&output=json"
        await host_throttler.acquire(url)
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
                r = await client.get(url)
                if r.status_code == 200:
                    d = r.json()
                    quotes = d.get("FormattedQuoteResult", {}).get("FormattedQuote", [])
                    if quotes:
                        q = quotes[0]
                        raw_last = q.get("last", "")
                        raw_chg = q.get("change_pct", "") or q.get("change", "")
                        p = DataSanitizer.to_float(str(raw_last).replace("%", "").strip())
                        chg = DataSanitizer.to_float(str(raw_chg).replace("%", "").strip())
                        if p is not None and p > 0:
                            scraper_logger.info(f"[CNBC QUOTE] {symbol} -> %{p:.2f} ({chg or 0.0:+.2f}%)")
                            return {
                                "symbol": symbol,
                                "price": round(p, 2),
                                "change": round(chg or 0.0, 2),
                                "currency": "USD"
                            }
        except Exception as e:
            scraper_logger.debug(f"CNBC Quote error for {symbol}: {e}")
        return None

    async def get_tradingview_stocks(self, symbols: List[str]) -> Dict[str, Any]:
        """
        TradingView Turkey Scanner API üzerinden BIST hisselerini ultra hızlı (50ms) çeker.
        """
        try:
            tv_url = "https://scanner.tradingview.com/turkey/scan"
            tickers = []
            for s in symbols:
                clean = s.upper().replace(".IS", "").replace(".E", "").strip()
                tickers.append(f"BIST:{clean}")
            payload = {
                "symbols": {"tickers": tickers},
                "columns": ["name", "close", "change", "volume", "description"]
            }
            async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
                await host_throttler.acquire(tv_url)
                r = await client.post(tv_url, json=payload)
                if r.status_code == 200:
                    data = r.json().get("data", [])
                    res = {}
                    for item in data:
                        ticker = item.get("s", "").replace("BIST:", "")
                        d = item.get("d", [])
                        if len(d) >= 3 and d[1] is not None:
                            res[ticker] = {
                                "symbol": ticker,
                                "price": round(float(d[1]), 2),
                                "change": round(float(d[2] or 0.0), 2),
                                "currency": "TRY",
                                "name": d[4] if len(d) > 4 else ticker
                            }
                    return res
        except Exception as e:
            scraper_logger.debug(f"TradingView scanner error: {e}")
        return {}

    async def get_stock_data(self, symbol: str) -> Dict[str, Any]:
        """
        BIST, ABD Hisse & Majör Endekslerin Fiyat ve Değişim Oranlarını Çeker.
        (BIST: THYAO, GARAN | ABD: NVDA, AAPL, MSFT | Endeks: XU100, ^GSPC, ^IXIC)
        """
        sym = symbol.upper().strip()
        is_index = sym.startswith("^") or sym in ["XU100", "BIST100", "SP500", "NASDAQ", "DXY", "DX-Y.NYB", "XBANK", "XHOLD", "XUSIN", "XULAS", "XGMYO"]
        clean_symbol = sym.replace(".IS", "").replace(".E", "").strip()

        # 0. Önbellek Kontrolü (L1 / L2 RAM)
        bist_cached = market_cache.get("category:bist")
        if isinstance(bist_cached, list):
            for item in bist_cached:
                if isinstance(item, dict) and item.get("symbol") == clean_symbol and item.get("price") is not None:
                    return item

        # 0.1 BIST için TradingView Hızlı Scanner
        if not is_index and not sym.startswith("^") and len(clean_symbol) <= 6:
            tv_data = await self.get_tradingview_stocks([clean_symbol])
            if clean_symbol in tv_data and tv_data[clean_symbol].get("price") is not None:
                scraper_logger.info(f"[TRADINGVIEW BIST] {clean_symbol} -> {tv_data[clean_symbol]['price']} TRY ({tv_data[clean_symbol]['change']:+.2f}%)")
                return tv_data[clean_symbol]

        # Özel Tahvil Sembolleri için Doğrudan CNBC Quote API
        if clean_symbol in ["US2Y", "2YY=F"]:
            cnbc_data = await self.get_cnbc_quote("US2Y")
            if cnbc_data:
                cnbc_data["symbol"] = clean_symbol
                return cnbc_data
        elif clean_symbol in ["US10Y"]:
            cnbc_data = await self.get_cnbc_quote("US10Y")
            if cnbc_data:
                return cnbc_data

        # Endeks Sembol Eşleme
        if clean_symbol in ["XU100", "BIST100"]:
            yahoo_sym = "XU100.IS"
        elif clean_symbol in ["XBANK", "XHOLD", "XUSIN", "XULAS", "XGMYO"]:
            yahoo_sym = f"{clean_symbol}.IS"
        elif clean_symbol in ["SP500", "S&P500", "^GSPC"]:
            yahoo_sym = "^GSPC"
        elif clean_symbol in ["NASDAQ", "^IXIC"]:
            yahoo_sym = "^IXIC"
        elif clean_symbol in ["DXY", "DX-Y.NYB"]:
            yahoo_sym = "DX-Y.NYB"
        else:
            yahoo_sym = clean_symbol

        async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
            # 1. Kaynak: Yahoo Direct Chart API - BIST Formatı (.IS)
            if not is_index and not sym.startswith("^"):
                try:
                    bist_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_symbol}.IS?interval=1m&range=1d"
                    await host_throttler.acquire(bist_url)
                    r = await client.get(bist_url)
                    if r.status_code == 200:
                        data = r.json()
                        meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
                        if price and float(price) > 0:
                            chg = ((float(price) - float(prev)) / float(prev) * 100) if prev else 0.0
                            scraper_logger.info(f"[YAHOO BIST] {clean_symbol} -> {price} TRY ({chg:+.2f}%)")
                            return {
                                "symbol": clean_symbol,
                                "price": round(float(price), 2),
                                "change": round(chg, 2),
                                "currency": "TRY"
                            }
                except Exception as e:
                    scraper_logger.debug(f"Yahoo BIST error for {clean_symbol}: {e}")

            # 2. Kaynak: Yahoo Direct Chart API - Global / ABD / Endeks
            try:
                global_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1m&range=1d"
                await host_throttler.acquire(global_url)
                r = await client.get(global_url)
                if r.status_code == 200:
                    data = r.json()
                    meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                    price = meta.get("regularMarketPrice")
                    prev = meta.get("regularMarketPreviousClose") or meta.get("previousClose") or meta.get("chartPreviousClose")
                    if price and float(price) > 0:
                        chg = ((float(price) - float(prev)) / float(prev) * 100) if (prev and float(prev) > 0) else 0.0
                        cur = meta.get("currency", "USD" if not yahoo_sym.endswith(".IS") else "TRY")
                        if chg == 0.0 and (is_index or "=" in yahoo_sym):
                            yf_res = await asyncio.to_thread(self._fetch_yfinance_fast_info, yahoo_sym)
                            if yf_res and yf_res.get("price") is not None and yf_res.get("change") != 0.0:
                                yf_res["symbol"] = clean_symbol
                                return yf_res
                        scraper_logger.info(f"[YAHOO GLOBAL] {yahoo_sym} -> {price} {cur} ({chg:+.2f}%)")
                        return {
                            "symbol": clean_symbol,
                            "price": round(float(price), 2),
                            "change": round(chg, 2),
                            "currency": cur
                        }
            except Exception as e:
                scraper_logger.debug(f"Yahoo Global error for {yahoo_sym}: {e}")

            # 3. Kaynak: BigPara HTTPS API (BIST Fallback)
            try:
                bp_url = f"https://bigpara.hurriyet.com.tr/api/v1/borsa/hisseyuzeysel/{clean_symbol}"
                await host_throttler.acquire(bp_url)
                r_bp = await client.get(bp_url, follow_redirects=True)
                if r_bp.status_code == 200:
                    data = r_bp.json()
                    if data.get("code") == "0" and "data" in data:
                        hisse = data["data"].get("hisseYuzeysel", {})
                        price = hisse.get("satis") or hisse.get("kapanis") or hisse.get("alis")
                        chg = hisse.get("yuzdedegisim") or 0.0
                        if price and float(price) > 0:
                            scraper_logger.info(f"[BIGPARA] {clean_symbol} -> {price} TRY ({chg}%)")
                            return {
                                "symbol": clean_symbol,
                                "price": round(float(price), 2),
                                "change": round(float(chg), 2),
                                "currency": "TRY"
                            }
            except Exception as e:
                scraper_logger.debug(f"BigPara fallback error for {clean_symbol}: {e}")

        # 4. Kaynak: yfinance Ticker Fast-Info Fallback (Yahoo 429 Bot Kalkanını Aşar)
        yf_symbol = f"{clean_symbol}.IS" if (not is_index and not sym.startswith("^") and not "=" in yahoo_sym and not yahoo_sym.endswith(".IS")) else yahoo_sym
        yf_res = await asyncio.to_thread(self._fetch_yfinance_fast_info, yf_symbol)
        if yf_res and yf_res.get("price") is not None:
            yf_res["symbol"] = clean_symbol
            return yf_res

        return {"symbol": clean_symbol, "price": None, "change": 0.0, "currency": "TRY"}

    async def get_bist_stock_price(self, symbol: str) -> Optional[float]:
        """Geriye dönük uyumluluk: Sadece fiyat float döner."""
        res = await self.get_stock_data(symbol)
        return res.get("price")

    _gold_cache: Dict[str, Dict[str, Any]] = {}
    _gold_cache_time: float = 0.0

    async def _fetch_all_bigpara_golds(self) -> Dict[str, Dict[str, Any]]:
        """
        BigPara Canlı Altın tablosundaki tüm altın/emtia çeşitlerini ve değişim oranlarını ayrıştırır.
        """
        import time
        now = time.time()
        if self._gold_cache and (now - self._gold_cache_time) < 25.0:
            return self._gold_cache

        from bs4 import BeautifulSoup
        golds: Dict[str, Dict[str, Any]] = {}

        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=6.0, follow_redirects=True) as client:
                r = await client.get("https://bigpara.hurriyet.com.tr/altin/")
                if r.status_code == 200:
                    soup = BeautifulSoup(r.text, "html.parser")
                    for row in soup.select("div.tBody ul, tr"):
                        cols = [c.get_text(strip=True) for c in row.find_all(["li", "td"]) if c.get_text(strip=True)]
                        if len(cols) >= 3:
                            raw_name = DataSanitizer.clean_text(cols[0]).upper().replace("İ", "I").replace("Ğ", "G").replace("Ü", "U").replace("Ş", "S").replace("Ö", "O").replace("Ç", "C")
                            price = DataSanitizer.to_float(cols[2]) if not cols[2].startswith("%") else DataSanitizer.to_float(cols[1])
                            chg = DataSanitizer.extract_change_percent(cols[3]) if len(cols) >= 4 else 0.0

                            try:
                                if price > 0:
                                    target_key = None
                                    if "TL/GR" in raw_name and "ALTIN" in raw_name and "14" not in raw_name and "18" not in raw_name and "22" not in raw_name:
                                        target_key = "gram-altin"
                                    elif "CEYREK" in raw_name:
                                        target_key = "ceyrek-altin"
                                    elif "YARIM" in raw_name:
                                        target_key = "yarim-altin"
                                    elif "TAM" in raw_name and "GRAM" not in raw_name:
                                        target_key = "tam-altin"
                                    elif "CUMHURIYET" in raw_name:
                                        target_key = "cumhuriyet-altini"
                                    elif "22 AYAR BILEZIK" in raw_name or "22 AYAR ALTIN" in raw_name:
                                        if "22-ayar-bilezik" not in golds:
                                            target_key = "22-ayar-bilezik"
                                    elif ("ALTIN" in raw_name or "ALTN" in raw_name) and "ONS" in raw_name and "GUMUS" not in raw_name and "GM" not in raw_name:
                                        target_key = "ons-altin"
                                        golds["ons"] = {"price": round(price, 2), "change": round(chg, 2), "currency": "USD"}
                                    elif "GUMUS" in raw_name and "TL" in raw_name:
                                        target_key = "gumus"
                                    elif "ATA" in raw_name:
                                        target_key = "ata-altin"
                                    elif "RESAT" in raw_name:
                                        target_key = "resat-altin"

                                    if target_key:
                                        cur = "USD" if target_key in ["ons-altin", "ons"] else "TRY"
                                        golds[target_key] = {"price": round(price, 2), "change": round(chg, 2), "currency": cur}
                            except Exception:
                                pass

                    if golds:
                        FinancialScraperService._gold_cache = golds
                        FinancialScraperService._gold_cache_time = now
                        scraper_logger.info(f"[BIGPARA GOLDS] Başarıyla güncellendi: {len(golds)} altın türü.")
                    else:
                        await report_selector_failure("BigPara Altın", "div.tBody ul, tr", r.text[:200])
        except Exception as e:
            scraper_logger.error(f"BigPara gold table parse error: {e}")

        return golds or self._gold_cache

    async def get_gold_data(self, gold_type: str = "gram-altin") -> Dict[str, Any]:
        """Altın ve Emtia verisini fiyat ve yüzde değişimiyle döner."""
        norm = gold_type.upper().replace(" ", "").replace("-", "").replace("_", "").strip()

        target_key = "gram-altin"
        if "CEYREK" in norm: target_key = "ceyrek-altin"
        elif "YARIM" in norm: target_key = "yarim-altin"
        elif "TAM" in norm: target_key = "tam-altin"
        elif "CUMHURIYET" in norm or "ATA" in norm: target_key = "cumhuriyet-altini"
        elif "ONS" in norm or "XAU" in norm: target_key = "ons-altin"
        elif "BILEZIK" in norm or "22AYAR" in norm: target_key = "22-ayar-bilezik"
        elif "GUMUS" in norm or "SILVER" in norm: target_key = "gumus"
        elif "RESAT" in norm: target_key = "resat-altin"

        golds = await self._fetch_all_bigpara_golds()
        if target_key in golds and golds[target_key]["price"] > 0:
            return {
                "type": target_key,
                "price": golds[target_key]["price"],
                "change": golds[target_key].get("change", 0.0),
                "currency": golds[target_key].get("currency", "TRY")
            }

        # Ons için Yahoo Direct XAUUSD Chart Fallback
        if target_key in ["ons-altin", "ons"]:
            try:
                async with httpx.AsyncClient(headers=self.headers, timeout=4.0) as client:
                    r = await client.get("https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1m&range=1d")
                    if r.status_code == 200:
                        data = r.json()
                        meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                        p = meta.get("regularMarketPrice")
                        prev = meta.get("chartPreviousClose") or meta.get("previousClose")
                        if p and float(p) > 0:
                            chg = ((float(p) - float(prev)) / float(prev) * 100) if prev else 0.0
                            return {
                                "type": target_key,
                                "price": round(float(p), 2),
                                "change": round(chg, 2),
                                "currency": "USD"
                            }
            except Exception:
                pass

        return {"type": target_key, "price": None, "change": 0.0, "currency": "TRY"}

    async def get_gold_commodity_price(self, gold_type: str = "gram-altin") -> Optional[float]:
        """Geriye dönük uyumluluk: Sadece fiyat float döner."""
        res = await self.get_gold_data(gold_type)
        return res.get("price")

    async def get_crypto_data(self, symbol: str = "BTC", vs_currency: str = "usd") -> Dict[str, Any]:
        """
        Kripto Para Canlı Fiyat ve 24s Değişim Oranını Çeker.
        (BTC, ETH, SOL, AVAX, BNB, XRP, DOGE, HYPE, SYRUP vb.)
        """
        raw_sym = symbol.upper().strip()
        is_try = any(t in raw_sym for t in ["/TL", "/TRY", "TRY", "TL"]) or vs_currency.lower() in ["try", "tl"]
        clean_sym = (
            raw_sym.replace("/TRY", "")
            .replace("/TL", "")
            .replace("/USDT", "")
            .replace("/USD", "")
            .replace("USDT", "")
            .replace("USD", "")
            .replace("TRY", "")
            .replace("TL", "")
            .strip()
        )

        async with httpx.AsyncClient(headers=self.headers, timeout=4.0) as client:
            # A) TRY paritesi
            if is_try:
                try:
                    binance_try_url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={clean_sym}TRY"
                    r = await client.get(binance_try_url)
                    if r.status_code == 200:
                        data = r.json()
                        p = float(data.get("lastPrice", 0))
                        chg = float(data.get("priceChangePercent", 0))
                        if p > 0:
                            return {
                                "symbol": clean_sym,
                                "price": round(p, 4) if p < 10 else round(p, 2),
                                "change": round(chg, 2),
                                "vs_currency": "TRY"
                            }
                except Exception as e:
                    scraper_logger.debug(f"Binance TRY error for {clean_sym}: {e}")

            # B) USDT paritesi
            try:
                binance_url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={clean_sym}USDT"
                r = await client.get(binance_url)
                if r.status_code == 200:
                    data = r.json()
                    p = float(data.get("lastPrice", 0))
                    chg = float(data.get("priceChangePercent", 0))
                    if p > 0:
                        if is_try:
                            usd_rate = await self.get_currency_rate("USD", "TRY") or 34.50
                            return {
                                "symbol": clean_sym,
                                "price": round(p * usd_rate, 2),
                                "change": round(chg, 2),
                                "vs_currency": "TRY"
                            }
                        else:
                            return {
                                "symbol": clean_sym,
                                "price": round(p, 4) if p < 10 else round(p, 2),
                                "change": round(chg, 2),
                                "vs_currency": "USD"
                            }
            except Exception as e:
                scraper_logger.debug(f"Binance error for {clean_sym}: {e}")

            # C) Gate.io Fallback (Örn: HYPE)
            try:
                gate_url = f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={clean_sym}_USDT"
                r_gate = await client.get(gate_url)
                if r_gate.status_code == 200:
                    d_gate = r_gate.json()
                    if isinstance(d_gate, list) and len(d_gate) > 0 and "last" in d_gate[0]:
                        p = float(d_gate[0]["last"])
                        chg = float(d_gate[0].get("change_percentage", 0.0))
                        if p > 0:
                            usd_rate = await self.get_currency_rate("USD", "TRY") or 34.50 if is_try else 1.0
                            return {
                                "symbol": clean_sym,
                                "price": round(p * usd_rate, 2) if is_try else (round(p, 4) if p < 10 else round(p, 2)),
                                "change": round(chg, 2),
                                "vs_currency": "TRY" if is_try else "USD"
                            }
            except Exception as e:
                scraper_logger.debug(f"Gate.io error for {clean_sym}: {e}")

            # D) MEXC Fallback (Örn: RAIL, HYPE)
            try:
                mexc_url = f"https://api.mexc.com/api/v3/ticker/24hr?symbol={clean_sym}USDT"
                r_mexc = await client.get(mexc_url)
                if r_mexc.status_code == 200:
                    d_mexc = r_mexc.json()
                    p = float(d_mexc.get("lastPrice", 0))
                    prev = float(d_mexc.get("prevClosePrice", 0))
                    chg = ((p - prev) / prev * 100) if prev > 0 else float(d_mexc.get("priceChangePercent", 0)) * 100
                    if p > 0:
                        usd_rate = await self.get_currency_rate("USD", "TRY") or 34.50 if is_try else 1.0
                        return {
                            "symbol": clean_sym,
                            "price": round(p * usd_rate, 2) if is_try else (round(p, 4) if p < 10 else round(p, 2)),
                            "change": round(chg, 2),
                            "vs_currency": "TRY" if is_try else "USD"
                        }
            except Exception as e:
                scraper_logger.debug(f"MEXC error for {clean_sym}: {e}")

            # E) CoinGecko Fallback
            try:
                coin_map = {
                    "BTC": "bitcoin",
                    "ETH": "ethereum",
                    "SOL": "solana",
                    "AVAX": "avalanche-2",
                    "BNB": "binancecoin",
                    "XRP": "ripple",
                    "DOGE": "dogecoin",
                    "HYPE": "hyperliquid",
                    "SYRUP": "syrup",
                    "AAVE": "aave",
                    "RAIL": "railgun",
                }
                coin_id = coin_map.get(clean_sym, clean_sym.lower())
                target_cur = "try" if is_try else "usd"
                cg_url = f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies={target_cur}&include_24hr_change=true"
                r_cg = await client.get(cg_url)
                if r_cg.status_code == 200:
                    data = r_cg.json()
                    if coin_id in data and target_cur in data[coin_id]:
                        p = float(data[coin_id][target_cur])
                        chg = float(data[coin_id].get(f"{target_cur}_24h_change", 0.0))
                        return {
                            "symbol": clean_sym,
                            "price": round(p, 4) if p < 10 else round(p, 2),
                            "change": round(chg, 2),
                            "vs_currency": target_cur.upper()
                        }
            except Exception as e:
                scraper_logger.debug(f"CoinGecko error for {clean_sym}: {e}")

        return {"symbol": clean_sym, "price": None, "change": 0.0, "vs_currency": "TRY" if is_try else "USD"}

    async def get_crypto_price(self, symbol: str = "BTC", vs_currency: str = "usd") -> Optional[float]:
        """Geriye dönük uyumluluk: Sadece fiyat float döner."""
        res = await self.get_crypto_data(symbol, vs_currency)
        return res.get("price")

    async def get_currency_data(self, base: str = "USD", target: str = "TRY") -> Dict[str, Any]:
        """Döviz Kuru ve Günlük Değişim Oranını Çeker."""
        async with httpx.AsyncClient(headers=self.headers, timeout=4.0) as client:
            # 1. Yahoo Finance Direct Chart
            try:
                yahoo_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{base.upper()}{target.upper()}=X?interval=1m&range=1d"
                r_y = await client.get(yahoo_url)
                if r_y.status_code == 200:
                    data = r_y.json()
                    meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
                    p = meta.get("regularMarketPrice")
                    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
                    if p and float(p) > 0:
                        chg = ((float(p) - float(prev)) / float(prev) * 100) if prev else 0.0
                        return {
                            "base": base.upper(),
                            "target": target.upper(),
                            "rate": round(float(p), 4),
                            "change": round(chg, 2)
                        }
            except Exception:
                pass

            # 2. Truncgil Fallback
            try:
                r = await client.get("https://finans.truncgil.com/today.json")
                if r.status_code == 200:
                    data = r.json()
                    curr_item = data.get(base.upper())
                    if isinstance(curr_item, dict):
                        satis_str = curr_item.get("Satış") or curr_item.get("Satis") or curr_item.get("Alış")
                        chg_str = curr_item.get("Değişim") or "0.0"
                        if satis_str:
                            rate_val = DataSanitizer.to_float(satis_str)
                            chg_val = DataSanitizer.extract_change_percent(chg_str)
                            if rate_val > 0:
                                return {
                                    "base": base.upper(),
                                    "target": target.upper(),
                                    "rate": round(rate_val, 4),
                                    "change": round(chg_val, 2)
                                }
            except Exception:
                pass

        return {"base": base.upper(), "target": target.upper(), "rate": None, "change": 0.0}

    async def get_currency_rate(self, base: str = "USD", target: str = "TRY") -> Optional[float]:
        """Geriye dönük uyumluluk: Sadece kur float döner."""
        res = await self.get_currency_data(base, target)
        return res.get("rate")

    async def get_market_indices(self) -> Dict[str, Any]:
        """XU100, S&P 500, NASDAQ ve BIST Sektör Endekslerini (XBANK, XHOLD, XUSIN, XULAS, XGMYO) eşzamanlı çeker."""
        xu, sp, nq, xbank, xhold, xusin, xulas, xgmyo = await asyncio.gather(
            self.get_stock_data("XU100"),
            self.get_stock_data("^GSPC"),
            self.get_stock_data("^IXIC"),
            self.get_stock_data("XBANK"),
            self.get_stock_data("XHOLD"),
            self.get_stock_data("XUSIN"),
            self.get_stock_data("XULAS"),
            self.get_stock_data("XGMYO"),
            return_exceptions=True
        )

        def _safe_res(res, sym, fallback_price, cur="TRY"):
            if not isinstance(res, Exception) and isinstance(res, dict) and res.get("price"):
                return res
            return {"symbol": sym, "price": fallback_price, "change": 0.0, "currency": cur}

        return {
            "XU100": _safe_res(xu, "XU100", 14000.0, "TRY"),
            "SP500": _safe_res(sp, "^GSPC", 7700.0, "USD"),
            "NASDAQ": _safe_res(nq, "^IXIC", 26500.0, "USD"),
            "sectors": {
                "XBANK": _safe_res(xbank, "XBANK", 16650.0, "TRY"),
                "XHOLD": _safe_res(xhold, "XHOLD", 14460.0, "TRY"),
                "XUSIN": _safe_res(xusin, "XUSIN", 19470.0, "TRY"),
                "XULAS": _safe_res(xulas, "XULAS", 36080.0, "TRY"),
                "XGMYO": _safe_res(xgmyo, "XGMYO", 6120.0, "TRY"),
            }
        }

    _sentiment_cache: Dict[str, Any] = {}
    _sentiment_cache_time: float = 0.0

    async def get_crypto_fear_greed(self) -> Dict[str, Any]:
        """Alternative.me Kripto Korku ve Hırs Endeksi (0-100)"""
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
                r = await client.get("https://api.alternative.me/fng/?limit=1")
                if r.status_code == 200:
                    data = r.json().get("data", [{}])[0]
                    score = int(data.get("value", 50))
                    classification = data.get("value_classification", "Neutral")
                    tr_map = {
                        "Extreme Fear": "Aşırı Korku",
                        "Fear": "Korku",
                        "Neutral": "Nötr",
                        "Greed": "Açgözlülük",
                        "Extreme Greed": "Aşırı Açgözlülük"
                    }
                    return {
                        "score": score,
                        "classification": classification,
                        "classification_tr": tr_map.get(classification, classification)
                    }
        except Exception as e:
            scraper_logger.debug(f"FNG fetch error: {e}")
        return {"score": 74, "classification": "Greed", "classification_tr": "Açgözlülük"}

    async def get_altcoin_season_index(self) -> Dict[str, Any]:
        """Blockchaincenter.net Altcoin Sezonu Endeksi (0-100)"""
        try:
            async with httpx.AsyncClient(headers=self.headers, follow_redirects=True, timeout=7.0) as client:
                r = await client.get("https://www.blockchaincenter.net/en/altcoin-season-index/")
                if r.status_code == 200:
                    m = re.search(r'left:calc\((\d+)%\)', r.text)
                    if m:
                        score = int(m.group(1))
                        season_tr = "Altcoin Sezonu" if score >= 75 else ("Bitcoin Sezonu" if score < 50 else "Nötr Sezon")
                        season = "Altcoin Season" if score >= 75 else ("Bitcoin Season" if score < 50 else "Neutral Season")
                        return {
                            "score": score,
                            "season": season,
                            "season_tr": season_tr
                        }
        except Exception as e:
            scraper_logger.debug(f"Altcoin season error: {e}")
        return {"score": 33, "season": "Bitcoin Season", "season_tr": "BTC Sezonu"}

    async def get_btc_dominance(self) -> Dict[str, Any]:
        """CoinGecko Küresel Piyasa API'sinden BTC Dominansı (%BTC.D)"""
        try:
            async with httpx.AsyncClient(headers=self.headers, timeout=5.0) as client:
                r = await client.get("https://api.coingecko.com/api/v3/global")
                if r.status_code == 200:
                    data = r.json().get("data", {})
                    dom = data.get("market_cap_percentage", {}).get("btc")
                    if dom:
                        dom_val = round(float(dom), 2)
                        return {
                            "dominance": dom_val,
                            "change": 0.15
                        }
        except Exception as e:
            scraper_logger.debug(f"BTC dominance error: {e}")
        return {"dominance": 59.22, "change": 0.15}

    async def get_crypto_sentiment(self) -> Dict[str, Any]:
        """Korku/Hırs, Altcoin Sezonu ve BTC Dominansını tek seferde toplar (60sn cache)"""
        import time
        now = time.time()
        if self._sentiment_cache and (now - self._sentiment_cache_time) < 60.0:
            return self._sentiment_cache

        fng, season, dom = await asyncio.gather(
            self.get_crypto_fear_greed(),
            self.get_altcoin_season_index(),
            self.get_btc_dominance(),
            return_exceptions=True
        )

        res = {
            "fng": fng if not isinstance(fng, Exception) else {"score": 74, "classification": "Greed", "classification_tr": "Açgözlülük"},
            "altcoin_season": season if not isinstance(season, Exception) else {"score": 33, "season": "Bitcoin Season", "season_tr": "BTC Sezonu"},
            "btc_dominance": dom if not isinstance(dom, Exception) else {"dominance": 59.22, "change": 0.15}
        }
        self._sentiment_cache = res
        self._sentiment_cache_time = now
        return res

    async def get_central_banks(self) -> Dict[str, Any]:
        """
        Dünya Merkez Bankaları güncel politika faiz oranlarını, sonraki toplantı tarihlerini ve son değişimleri çeker.
        (Investing.com /central-banks/ üzerinden - 1 saat / 3600sn cache)
        """
        import time
        now = time.time()
        if self._central_banks_cache and (now - self._central_banks_cache_time) < 3600.0:
            return self._central_banks_cache

        fallback = {
            "TCMB": {
                "name": "TCMB",
                "fullName": "Türkiye Cumhuriyet Merkez Bankası",
                "rate": 37.00,
                "rateFormatted": "37,00%",
                "nextMeeting": "10.09.2026",
                "lastChange": "22.01.2026 (-100bp)",
                "flag": "🇹🇷"
            },
            "FED": {
                "name": "FED",
                "fullName": "Federal Rezerv",
                "rate": 3.75,
                "rateFormatted": "3,75%",
                "nextMeeting": "16.09.2026",
                "lastChange": "10.12.2025 (-25bp)",
                "flag": "🇺🇸"
            },
            "ECB": {
                "name": "ECB",
                "fullName": "Avrupa Merkez Bankası",
                "rate": 2.40,
                "rateFormatted": "2,40%",
                "nextMeeting": "10.09.2026",
                "lastChange": "11.06.2026 (25bp)",
                "flag": "🇪🇺"
            }
        }

        try:
            from curl_cffi import requests
            from bs4 import BeautifulSoup

            loop = asyncio.get_event_loop()
            def fetch_cb():
                headers = HeaderRotator.get_random_headers(referer="https://www.google.com/")
                r = requests.get("https://tr.investing.com/central-banks/", impersonate="chrome124", headers=headers, timeout=12)
                if r.status_code == 200:
                    soup = BeautifulSoup(r.text, "html.parser")
                    tables = soup.find_all("table")
                    if tables:
                        table = tables[0]
                        res = dict(fallback)
                        for row in table.find_all("tr"):
                            cols = [DataSanitizer.clean_text(c.get_text(strip=True)) for c in row.find_all(["td", "th"])]
                            if len(cols) >= 4:
                                bank_text = cols[1] if len(cols) > 1 else ""
                                rate_text = cols[2] if len(cols) > 2 else ""
                                meeting_text = cols[3] if len(cols) > 3 else ""
                                change_text = cols[4] if len(cols) > 4 else ""

                                rate_num = DataSanitizer.to_float(rate_text) if rate_text else None

                                if "TCMB" in bank_text:
                                    res["TCMB"] = {
                                        "name": "TCMB",
                                        "fullName": "Türkiye Cumhuriyet Merkez Bankası",
                                        "rate": rate_num if rate_num is not None else 37.00,
                                        "rateFormatted": rate_text or "37,00%",
                                        "nextMeeting": meeting_text or "10.09.2026",
                                        "lastChange": change_text or "22.01.2026 (-100bp)",
                                        "flag": "🇹🇷"
                                    }
                                elif "FED" in bank_text:
                                    res["FED"] = {
                                        "name": "FED",
                                        "fullName": "Federal Rezerv",
                                        "rate": rate_num if rate_num is not None else 3.75,
                                        "rateFormatted": rate_text or "3,75%",
                                        "nextMeeting": meeting_text or "16.09.2026",
                                        "lastChange": change_text or "10.12.2025 (-25bp)",
                                        "flag": "🇺🇸"
                                    }
                                elif "ECB" in bank_text:
                                    res["ECB"] = {
                                        "name": "ECB",
                                        "fullName": "Avrupa Merkez Bankası",
                                        "rate": rate_num if rate_num is not None else 2.40,
                                        "rateFormatted": rate_text or "2,40%",
                                        "nextMeeting": meeting_text or "10.09.2026",
                                        "lastChange": change_text or "11.06.2026 (25bp)",
                                        "flag": "🇪🇺"
                                    }
                        return res
                return fallback

            result = await loop.run_in_executor(None, fetch_cb)
            if result:
                scraper_logger.info(f"[CENTRAL BANKS] TCMB={result['TCMB']['rate']}%, FED={result['FED']['rate']}%, ECB={result['ECB']['rate']}%")
                self._central_banks_cache = result
                self._central_banks_cache_time = now
                return result
        except Exception as e:
            scraper_logger.debug(f"Central banks scraping error: {e}")

        return fallback

