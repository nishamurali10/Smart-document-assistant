# backend/utils/pdf_generator.py
from fpdf import FPDF
from typing import Dict, List
import tempfile, os

def create_pdf_from_summary(summary_data: Dict, filename: str = "output.pdf") -> str:
    """
    Generate a formatted PDF for summaries or QA results.
    
    summary_data structure can be:
    {
        "title": "QA Result",
        "question": "...",
        "answer": "...",
        "sources": ["file1.pdf", "file2.pdf"],
        "overall_summary": "...",
        "per_page_summaries": [{"page": 1, "summary": "..."}, ...]
    }
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, summary_data.get("title", "Document Summary"), ln=True, align="C")
    pdf.ln(10)

    # If it's QA result
    if summary_data.get("question") and summary_data.get("answer"):
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, "Question:", ln=True)
        pdf.set_font("Arial", "", 11)
        pdf.multi_cell(0, 8, summary_data["question"])
        pdf.ln(5)

        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, "Answer:", ln=True)
        pdf.set_font("Arial", "", 11)
        pdf.multi_cell(0, 8, summary_data["answer"])
        pdf.ln(5)

        if summary_data.get("sources"):
            pdf.set_font("Arial", "B", 12)
            pdf.cell(0, 10, "Sources:", ln=True)
            pdf.set_font("Arial", "", 11)
            for src in summary_data["sources"]:
                pdf.multi_cell(0, 8, f"• {src}")
            pdf.ln(5)

    # If it's summarization result
    if summary_data.get("overall_summary"):
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, "Overall Summary:", ln=True)
        pdf.set_font("Arial", "", 11)
        pdf.multi_cell(0, 8, summary_data["overall_summary"])
        pdf.ln(5)

    if summary_data.get("per_page_summaries"):
        pdf.set_font("Arial", "B", 12)
        pdf.cell(0, 10, "Per-Page Summaries:", ln=True)
        pdf.set_font("Arial", "", 11)
        for page in summary_data["per_page_summaries"]:
            pdf.multi_cell(0, 8, f"Page {page['page']}:\n{page['summary']}\n")
            pdf.ln(2)

    # Save PDF to temp
    tmp_dir = tempfile.gettempdir()
    pdf_path = os.path.join(tmp_dir, filename)
    pdf.output(pdf_path)
    return pdf_path
