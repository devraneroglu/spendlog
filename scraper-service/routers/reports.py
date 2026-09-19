from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from typing import List, Optional, Any
from services.reports import MonthlyReportGenerator

router = APIRouter(prefix="/api/reports", tags=["Monthly Reports"])

class CategoryItem(BaseModel):
    name: str
    amount: float
    count: Optional[int] = 1

class ExpenseItem(BaseModel):
    date: str
    description: str
    category: str
    amount: float
    account: Optional[str] = ""

class MonthlyReportRequest(BaseModel):
    period: str
    total_amount: float
    transaction_count: Optional[int] = 0
    categories: List[CategoryItem] = []
    expenses: Optional[List[ExpenseItem]] = []

@router.post("/monthly-chart")
async def generate_monthly_chart(payload: MonthlyReportRequest):
    """
    Belirtilen dönem ve harcama kategorilerine göre FinTech Halka (Donut) Grafiği (PNG) üretir.
    """
    try:
        categories_dict = [c.dict() for c in payload.categories]
        png_bytes = MonthlyReportGenerator.generate_pie_chart(
            period=payload.period,
            total_amount=payload.total_amount,
            categories=categories_dict
        )
        return Response(content=png_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Harcama grafiği üretilemedi: {str(e)}")

@router.post("/monthly-pdf")
async def generate_monthly_pdf(payload: MonthlyReportRequest):
    """
    Belirtilen dönem ve harcama listesine göre detaylı Aylık Harcama Raporu (PDF) üretir.
    """
    try:
        categories_dict = [c.dict() for c in payload.categories]
        expenses_dict = [e.dict() for e in (payload.expenses or [])]
        tx_count = payload.transaction_count or len(expenses_dict)

        pdf_bytes = MonthlyReportGenerator.generate_monthly_pdf(
            period=payload.period,
            total_amount=payload.total_amount,
            transaction_count=tx_count,
            categories=categories_dict,
            expenses=expenses_dict
        )
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF raporu üretilemedi: {str(e)}")
