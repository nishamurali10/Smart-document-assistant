from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.auth.auth import get_current_user
from backend.db import models, database
from fastapi.responses import FileResponse
import tempfile
import os

router = APIRouter(prefix="/history", tags=["History"])

@router.get("/")
def get_user_history(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Get all past interactions (QA + Summarizer) for the logged-in user.
    """
    interactions = (
        db.query(models.Interaction)
        .filter(models.Interaction.user_id == current_user.id)
        .order_by(models.Interaction.created_at.desc())
        .all()
    )

    history = [
        {
            "id": inter.id,
            "type": inter.type,
            "query": inter.query,
            "answer": inter.answer,
            "sources": inter.sources,
            "created_at": inter.created_at,
        }
        for inter in interactions
    ]

    return {"user": current_user.email, "history": history}


@router.get("/export")
def export_history(
    format: str = "txt",  # txt or pdf
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Export user history as TXT or PDF.
    """
    interactions = (
        db.query(models.Interaction)
        .filter(models.Interaction.user_id == current_user.id)
        .order_by(models.Interaction.created_at.asc())
        .all()
    )

    if not interactions:
        return {"error": "No history available to export."}

    export_content = ""
    for inter in interactions:
        export_content += f"[{inter.created_at}] ({inter.type.upper()})\n"
        export_content += f"Query: {inter.query}\n"
        export_content += f"Answer: {inter.answer}\n"
        if inter.sources:
            export_content += f"Sources: {inter.sources}\n"
        export_content += "\n" + "-" * 50 + "\n\n"

    if format == "txt":
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        tmp_file.write(export_content.encode("utf-8"))
        tmp_file.close()
        return FileResponse(
            path=tmp_file.name,
            media_type="text/plain",
            filename="history.txt"
        )

    elif format == "pdf":
        from backend.utils.pdf_generator import create_pdf_from_summary
        summary_data = {
            "title": f"{current_user.name}'s History",
            "overall_summary": export_content
        }
        pdf_path = create_pdf_from_summary(summary_data)
        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename="history.pdf"
        )

    else:
        return {"error": "Invalid format. Use 'txt' or 'pdf'."}
