from fastapi import APIRouter, UploadFile, File, Query, Depends
from fastapi.responses import FileResponse
import tempfile
import json
import os

from services.summarizer import summarize_pdf
from backend.log_config import logger
from backend.utils.pdf_generator import create_pdf_from_summary
from backend.auth.auth import get_current_user
from backend.db import models, database
from sqlalchemy.orm import Session

router = APIRouter(prefix="/summarize", tags=["Summarize"])

@router.get("/")
async def summarize_root(current_user: models.User = Depends(get_current_user)):
    """Health check for Summarization endpoint, requires login."""
    logger.info(f"📝 Summarize endpoint called by {current_user.email}")
    return {"message": "Summarization endpoint working!", "user": current_user.email}


@router.post("/pdf")
async def summarize_uploaded_pdf(
    file: UploadFile = File(...),
    length: str = Query("medium", enum=["short", "medium", "long"]),
    model: str = Query("pegasus", enum=["pegasus", "bart", "auto"]),
    per_page: bool = Query(False, description="Include per-page summaries if True"),
    download: bool = Query(False, description="Set True to download summary as PDF"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Upload a PDF and get its summary.
    Saves interaction history for logged-in users.
    """
    logger.info(
        f"📄 Summarize request by {current_user.email}: "
        f"file={file.filename}, length={length}, model={model}, per_page={per_page}, download={download}"
    )

    tmp_path = None
    try:
        # Save uploaded PDF to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Summarize the PDF using the file path
        result = summarize_pdf(tmp_path, length=length, model=model, per_page=per_page)

        # Save interaction in DB
        interaction = models.Interaction(
            user_id=current_user.id,
            type="summary",
            query=f"Summarize {file.filename} ({length}, {model}, per_page={per_page})",
            answer=json.dumps(result) if not isinstance(result, str) else result
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

        # Optionally generate downloadable PDF
        if download:
            summary_data = {
                "title": f"Summary of {file.filename}",
                "overall_summary": json.dumps(result, indent=2) if not isinstance(result, str) else result
            }
            pdf_path = create_pdf_from_summary(summary_data)
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"summary_{file.filename}"
            )

        return {"result": result, "interaction_id": interaction.id}

    except Exception as e:
        logger.error(f"❌ Summarization failed for {current_user.email}: {str(e)}")
        return {"error": str(e)}

    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
