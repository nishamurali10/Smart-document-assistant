# services/summarizer.py

from typing import List, Dict, Tuple
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from transformers import pipeline
import torch
import re

# ---------- Model registry & loader ----------

_MODEL_MAP = {
    "pegasus": "google/pegasus-cnn_dailymail",
    "bart": "facebook/bart-large-cnn",
    # "led": "allenai/led-large-16384",  # optional (heavy) – add later
}

def _pick_device() -> int:
    """
    Returns 0 for CUDA GPU if available, else -1 for CPU
    """
    return 0 if torch.cuda.is_available() else -1

def _get_summarizer(model_key: str):
    """
    model_key: 'pegasus', 'bart', or 'auto'
    """
    if model_key == "auto":
        hub_id = _MODEL_MAP["pegasus"]
    else:
        hub_id = _MODEL_MAP.get(model_key, _MODEL_MAP["pegasus"])

    return pipeline(
        task="summarization",
        model=hub_id,
        device=_pick_device()
    )

# ---------- Cleaning helpers ----------

def _clean_text(text: str) -> str:
    """
    Removes boilerplate junk and artifacts often seen in scraped PDFs.
    """
    junk_patterns = [
        r"Back to .*?home",
        r"Back to the page you came from",
        r"Mail Online",
        r"Page \d+ of \d+",      # page numbers
        r"https?://\S+",         # URLs
        r"Click here to .*",     # "Click here to ..." links
        r"Follow us on .*",      # "Follow us on ..." lines
        r"@\w+",                 # Social media handles like @username
    ]
    for pat in junk_patterns:
        text = re.sub(pat, "", text, flags=re.IGNORECASE)

    # Remove weird <n> markers and dot placeholders
    text = re.sub(r"(\.\s*<n>\s*)+", " ", text)  # collapse ".<n> .<n>" → " "
    text = re.sub(r"<n>", " ", text)             # remove stray <n>
    text = re.sub(r"\.{2,}", ".", text)          # collapse "....." → "."

    # Collapse excessive whitespace
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# ---------- Length presets ----------

def _length_presets(length: str) -> Dict[str, Tuple[int, int]]:
    """
    Returns token (not characters) min/max for:
    - per-chunk summarization
    - meta-summary (overall)
    - per-page summary
    """
    length = (length or "medium").lower()
    if length == "short":
        return {
            "chunk": (60, 100),
            "overall": (150, 250),
            "page": (90, 150),
        }
    if length == "long":
        return {
            "chunk": (160, 260),
            "overall": (300, 450),
            "page": (150, 220),
        }
    # medium (default)
    return {
        "chunk": (120, 180),
        "overall": (220, 360),
        "page": (120, 180),
    }

# ---------- Core summarization ----------

def _summarize_text(summarizer, text: str, min_len: int, max_len: int) -> str:
    """
    Summarizes text using transformers pipeline
    Adjusts max_length dynamically if input is shorter.
    """
    input_len = len(text.split())
    # If the input is shorter than max_len, shrink max_len to avoid warnings
    if input_len < max_len:
        max_len = max(min_len + 5, int(input_len * 0.9))

    result = summarizer(
        text,
        min_length=min_len,
        max_length=max_len,
        do_sample=False
    )
    return result[0]["summary_text"]

def summarize_pdf(
    file_path: str,
    length: str = "medium",
    model: str = "pegasus",   # 'pegasus' | 'bart' | 'auto'
    per_page: bool = False     # Optional per-page summary
) -> Dict:
    """
    Summarize a PDF:
      1) Always generate overall summary
      2) Generate per-page summaries only if per_page=True
    """
    # Load pages
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    # Build summarizer
    summarizer = _get_summarizer(model)
    lens = _length_presets(length)

    # Split document into chunks for overall summary
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=350
    )
    chunks = splitter.split_documents(pages)

    # Summarize each chunk
    chunk_summaries: List[str] = []
    for c in chunks:
        txt = _clean_text(c.page_content)
        if not txt.strip():
            continue
        try:
            s = _summarize_text(summarizer, txt, *lens["chunk"])
            chunk_summaries.append(s)
        except Exception:
            continue

    # Overall summary
    if chunk_summaries:
        combined = " ".join(chunk_summaries)
        combined = _clean_text(combined)
        overall_summary = _summarize_text(summarizer, combined, *lens["overall"])
    else:
        overall_summary = "No textual content found to summarize."

    # Optional per-page summaries
    per_page_summaries = []
    if per_page:
        for i, page in enumerate(pages, start=1):
            txt = _clean_text(page.page_content or "")
            if not txt.strip():
                per_page_summaries.append({"page": i, "summary": "⚠️ Empty or non-text page."})
                continue
            try:
                s = _summarize_text(summarizer, txt, *lens["page"])
            except Exception:
                s = "⚠️ Could not summarize this page."
            per_page_summaries.append({"page": i, "summary": _clean_text(s)})

    # Final cleanup
    overall_summary = _clean_text(overall_summary)

    result = {
        "overall_summary": overall_summary,
        "length": length,
        "model": model,
        "pages_summarized": len(pages)
    }
    if per_page:
        result["per_page_summaries"] = per_page_summaries

    return result
