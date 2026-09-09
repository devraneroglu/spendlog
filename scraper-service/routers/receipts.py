from fastapi import APIRouter, UploadFile, File, HTTPException
from services.receipt_parser import FuelReceiptParserService
import logging

router = APIRouter(prefix="/api/receipts", tags=["Receipts & Vision AI"])
logger = logging.getLogger(__name__)

receipt_parser_service = FuelReceiptParserService()

@router.post("/parse-fuel-receipt")
async def parse_fuel_receipt(file: UploadFile = File(...)):
    """
    Akaryakıt fişi görselini yükleyerek JSON formatında ayrıştırır.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Boş dosya yüklendi.")

        result = receipt_parser_service.parse_receipt_image(content, filename=file.filename or "receipt.jpg")
        return result
    except Exception as e:
        logger.error(f"Fiş ayrıştırma router hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fiş okuma hatası: {str(e)}")
