import os
import logging
from logging.handlers import RotatingFileHandler

def setup_logger():
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "scraper.log")

    logger = logging.getLogger("spendlog.scraper")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        # 1. Console Handler
        console_handler = logging.StreamHandler()
        console_format = logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
        console_handler.setFormatter(console_format)
        logger.addHandler(console_handler)

        # 2. Rotating File Handler (Max 5MB, 3 backup)
        file_handler = RotatingFileHandler(log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
        file_format = logging.Formatter('{"time": "%(asctime)s", "level": "%(levelname)s", "module": "%(module)s", "message": "%(message)s"}', datefmt="%Y-%m-%dT%H:%M:%S")
        file_handler.setFormatter(file_format)
        logger.addHandler(file_handler)

    return logger

scraper_logger = setup_logger()
