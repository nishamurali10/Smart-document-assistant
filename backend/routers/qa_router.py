from fastapi import APIRouter, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from backend.log_config import logger
from services.qa_service import answer_question
from backend.utils.pdf_generator import create_pdf_from_summary
from backend.auth.auth import get_current_user
from backend.db import models, database
from sqlalchemy.orm import Session
import tempfile
import os
import json

router = APIRouter(prefix="/qa", tags=["QA"])

@router.get("/")
async def qa_root(current_user: models.User = Depends(get_current_user)):
    """Health check for QA endpoint, requires login."""
    logger.info(f"🤖 QA endpoint called by {current_user.email}")
    return {"message": "QA endpoint working!", "user": current_user.email}


@router.post("/ask")
async def ask_question(
    question: str = Form(...),
    file: UploadFile = File(...),
    download_pdf: bool = Form(False),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Accepts a user question and a PDF file,
    extracts answers from the document, and returns them.
    Saves interaction history for logged-in users.
    """
    logger.info(f"📌 QA request by {current_user.email}: {question} with file {file.filename}")

    tmp_path = None
    try:
        # Save uploaded PDF temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        # Call QA service using the file path
        with open(tmp_path, "rb") as f:
            answer, sources = answer_question(f, question)

        # Save interaction in DB
        interaction = models.Interaction(
            user_id=current_user.id,
            type="qa",
            query=question,
            answer=answer,
            sources=", ".join(sources) if sources else None
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)

        response_data = {
            "query": question,
            "answer": answer,
            "sources": sources,
            "interaction_id": interaction.id
        }

        # Generate optional PDF download
        if download_pdf:
            summary_data = {
                "title": "QA Result",
                "overall_summary": f"Question: {question}\n\nAnswer: {answer}\n\nSources: {', '.join(sources)}"
            }
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_pdf:
                pdf_path = create_pdf_from_summary(summary_data, filename=os.path.basename(tmp_pdf.name))

            return FileResponse(
                path=pdf_path,
                media_type="application/pdf",
                filename="QA_Result.pdf"
            )

        return response_data

    except Exception as e:
        logger.error(f"❌ Error processing QA for {current_user.email}: {str(e)}")
        return {"error": "Failed to process QA", "details": str(e)}

    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
