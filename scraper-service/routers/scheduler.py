from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any

class CronUpdateRequest(BaseModel):
    job_key: str
    cron_expression: str

class ToggleJobRequest(BaseModel):
    job_key: str
    is_enabled: bool

class UrlUpdateRequest(BaseModel):
    job_key: str
    target_url: str

class TriggerJobRequest(BaseModel):
    job_key: str

def get_scheduler_router(scheduler_service):
    router = APIRouter(prefix="/api/scheduler", tags=["Scheduler"])

    @router.get("/status")
    async def get_status():
        return {
            "jobs": scheduler_service.job_statuses,
            "metrics": scheduler_service.get_system_metrics(),
            "latest_prices": scheduler_service.latest_prices
        }

    @router.post("/toggle")
    async def toggle_job(req: ToggleJobRequest):
        success = scheduler_service.toggle_job(req.job_key, req.is_enabled)
        if not success:
            raise HTTPException(status_code=400, detail="Görev durumu değiştirilemedi.")
        durum = "aktifleştirildi" if req.is_enabled else "duraklatıldı"
        return {"success": True, "message": f"{req.job_key} görevi başarıyla {durum}."}

    @router.post("/update-cron")
    async def update_cron(req: CronUpdateRequest):
        success = scheduler_service.add_or_update_job(req.job_key, req.cron_expression)
        if not success:
            raise HTTPException(status_code=400, detail="Geçersiz Cron ifadesi veya bilinmeyen iş anahtarı.")
        return {"success": True, "message": f"{req.job_key} zamanlaması güncellendi."}

    @router.post("/update-url")
    async def update_url(req: UrlUpdateRequest):
        success = scheduler_service.update_target_url(req.job_key, req.target_url)
        if not success:
            raise HTTPException(status_code=400, detail="Hedef URL güncellenemedi.")
        return {"success": True, "message": f"{req.job_key} kaynak URL adresi güncellendi."}

    @router.post("/update-backup-url")
    async def update_backup_url(req: UrlUpdateRequest):
        success = scheduler_service.update_backup_url(req.job_key, req.target_url)
        if not success:
            raise HTTPException(status_code=400, detail="Yedek URL güncellenemedi.")
        return {"success": True, "message": f"{req.job_key} yedek kaynak URL adresi güncellendi."}

    @router.post("/trigger-now")
    async def trigger_now(req: TriggerJobRequest):
        success = await scheduler_service.trigger_job_now(req.job_key)
        if not success:
            raise HTTPException(status_code=400, detail="İş tetiklenemedi.")
        return {"success": True, "message": f"{req.job_key} kazıma görevi başarıyla tetiklendi."}

    @router.post("/trigger-all")
    async def trigger_all():
        result = await scheduler_service.trigger_all_jobs()
        return {
            "success": True,
            "message": f"{result['triggered_count']} adet aktif kazıyıcı görevi eşzamanlı tetiklendi.",
            "data": result
        }

    return router

