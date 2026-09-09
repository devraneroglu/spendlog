from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from services.pdf_parser import PdfParserService

router = APIRouter(prefix="/api/pdf", tags=["PDF Parser"])
pdf_service = PdfParserService()

@router.post("/parse")
async def parse_pdf(
    file: UploadFile = File(...),
    bank_type: Optional[str] = Form("auto")
):
    """
    Kredi kartı ekstre PDF'ini Microsoft MarkItDown ile ayrıştırır.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir PDF dosyası yükleyin.")

    try:
        contents = await file.read()
        result = pdf_service.parse_credit_card_pdf(contents, file.filename, bank_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF ayrıştırma hatası: {str(e)}")
