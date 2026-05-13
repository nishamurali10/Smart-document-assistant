import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.qa_service import process_pdf
from backend.log_config import logger

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = "uploaded_files"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    logger.info(f"📂 Upload attempt: {file.filename}")

    if not file.filename.endswith(".pdf"):
        logger.warning(f"⚠️ Upload rejected (not a PDF): {file.filename}")
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        logger.info(f"✅ File saved: {file_path}")

        # Process PDF into vector store
        process_pdf(file_path)

        msg = f"{file.filename} uploaded and processed successfully."
        logger.info(f"✅ {msg}")
        return {"message": msg}

    except Exception as e:
        logger.error(f"❌ Error while uploading {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
