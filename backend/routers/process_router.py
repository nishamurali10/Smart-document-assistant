from fastapi import APIRouter, UploadFile, File, HTTPException
import os
from backend.services.pdf_utils import extract_text_from_pdf
from backend.services.summarizer import summarize_text

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/process/summarize/")
async def process_and_summarize(file: UploadFile = File(...), max_length: int = 120):
    """
    Upload a PDF, extract text, and summarize it.
    """
    try:
        # Save file
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Extract text
        extracted_text = extract_text_from_pdf(file_path)
        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in PDF.")

        # Summarize text
        summary = summarize_text(extracted_text, max_length=max_length)

        return {
            "filename": file.filename,
            "summary": summary
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
