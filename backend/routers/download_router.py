# backend/routers/download_router.py
from fastapi import APIRouter
from fastapi.responses import FileResponse
from backend.utils.pdf_generator import create_pdf_from_summary

router = APIRouter(prefix="/download", tags=["Download"])

@router.post("/summary")
async def download_summary(summary_data: dict):
    """
    Receives a JSON with summarization or QA result and returns a downloadable PDF.
    """
    pdf_path = create_pdf_from_summary(summary_data, filename="summary.pdf")
    return FileResponse(pdf_path, filename="summary.pdf", media_type="application/pdf")
