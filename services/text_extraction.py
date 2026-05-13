import pdfplumber
from typing import Union

def extract_text_from_pdf(pdf_input: Union[str, bytes]) -> str:
    """
    Extracts text from PDF.
    pdf_input: can be a file path (str) or raw bytes
    """
    text = ""
    if isinstance(pdf_input, bytes):
        import io
        with pdfplumber.open(io.BytesIO(pdf_input)) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    elif isinstance(pdf_input, str):
        with pdfplumber.open(pdf_input) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    else:
        raise TypeError("Unsupported input type for PDF extraction.")
    return text.strip()
