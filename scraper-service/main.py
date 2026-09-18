from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid
from services.scrapers import FinancialScraperService
from services.scheduler import DynamicSchedulerService
from services.logger import scraper_logger
from services.alert_service import scraper_alert_service
from routers.pdf import router as pdf_router
from routers.prices import router as prices_router
from routers.receipts import router as receipts_router
from routers.scheduler import get_scheduler_router

app = FastAPI(
    title="SpendLog V2 — Scraping & PDF Engine",
    version="2.0.0",
    description="Microsoft MarkItDown PDF Ekstre Ayrıştırıcı & UI Yönetimli Finansal Veri Kazıyıcı"
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    trace_id = f"SCRP-{uuid.uuid4().hex[:6].upper()}"
    error_msg = str(exc)
    scraper_logger.error(f"[{trace_id}] Endpoint Error {request.method} {request.url.path}: {error_msg}")

    # Arka planda Telegram Alarmı Gönder
    import asyncio
    asyncio.create_task(scraper_alert_service.send_scraper_alert(
        job_name=f"Endpoint: {request.method} {request.url.path}",
        error_message=error_msg,
        trace_id=trace_id
    ))

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "title": "Scraper Mikroservis Hatası",
            "detail": error_msg,
            "trace_id": trace_id
        }
    )

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Services
scraper_service = FinancialScraperService()
scheduler_service = DynamicSchedulerService(scraper_service)

# Routers
app.include_router(pdf_router)
app.include_router(prices_router)
app.include_router(receipts_router)
app.include_router(get_scheduler_router(scheduler_service))

@app.on_event("startup")
async def startup_event():
    scraper_logger.info("🚀 SpendLog V2 Python Scraper Mikroservisi Başlatıldı.")
    scheduler_service.start()
    # Başlangıçta önbelleği arka planda otomatik ısıt (Cold-Start Prevention)
    import asyncio
    asyncio.create_task(scheduler_service.trigger_all_jobs())

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "SpendLog V2 Scraping & PDF Engine",
        "engine": "Microsoft MarkItDown + FastAPI + APScheduler"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
