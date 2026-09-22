import os
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import Optional

# Logs dizini
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

ACTIVITY_LOG_FILE = os.path.join(LOG_DIR, "scraper_activity.txt")
OPERATIONS_LOG_FILE = os.path.join(LOG_DIR, "scraper_operations.txt")

def setup_logger():
    logger = logging.getLogger("spendlog.scraper")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        # 1. Console Handler
        console_handler = logging.StreamHandler()
        console_format = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        console_handler.setFormatter(console_format)
        logger.addHandler(console_handler)

        # 2. Düz Metin Dosya Loglayıcı (Notepad ile doğrudan okunabilir .txt)
        file_handler = RotatingFileHandler(ACTIVITY_LOG_FILE, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8")
        file_format = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        file_handler.setFormatter(file_format)
        logger.addHandler(file_handler)

    return logger

scraper_logger = setup_logger()

def log_scrape_operation(
    category: str,
    symbol: str,
    price: Optional[float],
    change: Optional[float] = None,
    currency: str = "TRY",
    source: str = "Unknown",
    latency_ms: float = 0.0,
    status: str = "SUCCESS",
    details: Optional[str] = None
):
    """
    Her kazıma operasyonunu Notepad ile doğrudan okunabilir scraper_operations.txt dosyasına yazar.
    Örnek: [2026-09-22 16:15:00] [SUCCESS] [STOCKS] THYAO | Fiyat: 299.00 TRY | Değişim: +1.54% | Kaynak: TradingView | Süre: 45.2ms
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    chg_str = f"{change:+.2f}%" if change is not None else "N/A"
    price_str = f"{price:.2f} {currency}" if price is not None else "BULUNAMADI"
    
    line = f"[{now_str}] [{status.upper()}] [{category.upper()}] {symbol.upper()} | Fiyat: {price_str} | Değişim: {chg_str} | Kaynak: {source} | Süre: {latency_ms:.1f}ms"
    if details:
        line += f" | Not: {details}"
    line += "\n"

    try:
        with open(OPERATIONS_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        scraper_logger.debug(f"Failed to write operation log: {e}")

