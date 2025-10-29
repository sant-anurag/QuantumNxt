import argparse
import json
import os
import sys
import getpass
from typing import Dict, Any, Optional, List, Tuple
from datetime import date, datetime
import re

# --------------------------
# Local file text extraction
# --------------------------
def extract_text_from_pdf(path: str) -> str:
    from pypdf import PdfReader
    text_parts = []
    with open(path, "rb") as f:
        reader = PdfReader(f)
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts).strip()

def extract_text_from_docx(path: str) -> str:
    from docx import Document
    try:
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        print(f"Error extracting text from DOCX: {e}")
        raise ValueError("Not able to extract text from file. \nIf file is in .doc format, please convert it to .docx and try again.")

def extract_text_from_txt(path: str) -> str:
    with open(path, "rb") as f:
        return f.read().decode("utf-8", errors="ignore")

def extract_text(path: str) -> str:
    low = path.lower()
    if low.endswith(".pdf"):
        return extract_text_from_pdf(path)
    elif low.endswith(".docx") or low.endswith(".doc"):
        return extract_text_from_docx(path)
    elif low.endswith(".txt"):
        return extract_text_from_txt(path)
    else:
        raise ValueError("Unsupported file format. Use PDF, DOCX, or TXT.")

# --------------------------
# JSON Schema we want back
# --------------------------
SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "location": {"type": "string"},
        "skills": {"type": "array", "items": {"type": "string"}},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "company": {"type": "string"},
                    "location": {"type": "string"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "current": {"type": "boolean"},
                    # "bullets": {"type": "array", "items": {"type": "string"}},
                    # "tech": {"type": "array", "items": {"type": "string"}}
                },
                "required": ["title", "company"]
            }
        },
        "education": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "degree": {"type": "string"},
                    "institution": {"type": "string"},
                    "start_year": {"type": "string"},
                    "end_year": {"type": "string"},
                    # "score": {"type": "string"}
                }
            }
        },
    },
    "required": ["name", "email", "skills", "experience"],
    "additionalProperties": False
}

SYSTEM_PROMPT = """You are a resume parsing engine. Extract clean, normalized JSON from the raw resume text.

Rules:
- Do NOT invent details. If a field is missing, use an empty string or empty array.
- Normalize phone numbers to international format when possible.
- Keep dates as given if unclear (do not hallucinate exact dates).
- Return JSON that strictly matches the provided JSON Schema.
- If something is truly unavailable, leave it empty.
- Keep skills in order of technical, semitechnical, personal or communication skills and then other skills.
"""

# --------------------------
# Experience date utilities
# --------------------------
def _is_present(s: Optional[str]) -> bool:
    if not s:
        return False
    s = s.strip().lower()
    return s in {"present", "current", "till date", "to date", "now"}

def _clean_date_str(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace(",", " ")).strip()

def _parse_as_of(as_of: Optional[str]) -> date:
    """Parse --as-of YYYY-MM or YYYY-MM-DD; default = today."""
    if not as_of:
        return date.today()
    as_of = as_of.strip()
    # Try YYYY-MM-DD
    m = re.match(r"^\d{4}-\d{2}-\d{2}$", as_of)
    if m:
        y, mth, d = map(int, as_of.split("-"))
        return date(y, mth, d)
    # Try YYYY-MM (use first of month)
    m = re.match(r"^\d{4}-\d{2}$", as_of)
    if m:
        y, mth = map(int, as_of.split("-"))
        return date(y, mth, 1)
    # Fallback to dateutil if present
    try:
        from dateutil import parser as dparser  # type: ignore
        dt = dparser.parse(as_of, default=datetime(2000, 1, 1), dayfirst=False, fuzzy=True)
        return dt.date()
    except Exception:
        raise ValueError("Invalid --as-of format. Use YYYY-MM or YYYY-MM-DD")

def _parse_date_fuzzy(s: Optional[str]) -> Optional[date]:
    """Parse many human formats into a date (first day of month fallback)."""
    if not s:
        return None
    s_raw = s
    s = _clean_date_str(s)
    if _is_present(s):
        return date.today()

    # Try python-dateutil if available
    try:
        from dateutil import parser as dparser  # type: ignore
        dt = dparser.parse(s, default=datetime(2000, 1, 1), dayfirst=False, fuzzy=True)
        return date(dt.year, dt.month, 1)
    except Exception:
        pass

    # Manual month-name parsing (fallback without dateutil)
    MONTHS = {
        "jan": 1, "january": 1,
        "feb": 2, "february": 2,
        "mar": 3, "march": 3,
        "apr": 4, "april": 4,
        "may": 5,
        "jun": 6, "june": 6,
        "jul": 7, "july": 7,
        "aug": 8, "august": 8,
        "sep": 9, "sept": 9, "september": 9,
        "oct": 10, "october": 10,
        "nov": 11, "november": 11,
        "dec": 12, "december": 12,
    }

    # "Sep 2022" / "September 2022"
    m = re.match(r"(?i)\b([A-Za-z]{3,9})\b\s+(\d{4})", s)
    if m:
        mon_name = m.group(1).lower()
        yr = int(m.group(2))
        if mon_name in MONTHS:
            return date(yr, MONTHS[mon_name], 1)

    # "2022 Sep" / "2022 September"
    m = re.match(r"(?i)(\d{4})\s+\b([A-Za-z]{3,9})\b", s)
    if m:
        yr = int(m.group(1))
        mon_name = m.group(2).lower()
        if mon_name in MONTHS:
            return date(yr, MONTHS[mon_name], 1)

    # 2020-05 or 2020/05
    m = re.match(r"(\d{4})[-/](\d{1,2})", s)
    if m:
        y, mth = int(m.group(1)), int(m.group(2))
        return date(y, max(1, min(12, mth)), 1)

    # 05/2020
    m = re.match(r"(\d{1,2})[-/](\d{4})", s)
    if m:
        mth, y = int(m.group(1)), int(m.group(2))
        return date(y, max(1, min(12, mth)), 1)

    # Year only "2022"
    m = re.match(r"(\d{4})$", s)
    if m:
        return date(int(m.group(1)), 1, 1)

    return None

def _merge_intervals(intervals: List[Tuple[date, date]]) -> List[Tuple[date, date]]:
    """Merge overlapping [start, end] month-bounded intervals."""
    if not intervals:
        return []
    normalized = [(min(s, e), max(s, e)) for s, e in intervals if s and e]
    if not normalized:
        return []
    normalized.sort(key=lambda x: x[0])
    merged = [normalized[0]]
    for cur_s, cur_e in normalized[1:]:
        last_s, last_e = merged[-1]
        if cur_s <= last_e:  # overlap/contiguous
            merged[-1] = (last_s, max(last_e, cur_e))
        else:
            merged.append((cur_s, cur_e))
    return merged

def _months_between(a: date, b: date) -> int:
    """Months difference (inclusive start month, exclusive end boundary)."""
    if a > b:
        a, b = b, a
    months = (b.year - a.year) * 12 + (b.month - a.month)
    return max(0, months)

def humanize_months(months: int) -> str:
    y, m = divmod(max(0, months), 12)
    parts = []
    if y:
        parts.append(f"{y} year{'s' if y != 1 else ''}")
    if m:
        parts.append(f"{m} month{'s' if m != 1 else ''}")
    return " ".join(parts) if parts else "0 months"

def compute_total_experience(exp_list: List[Dict[str, Any]], as_of: Optional[date] = None, debug: bool = False) -> Dict[str, Any]:
    """
    Returns:
      - total_experience_months (int)
      - total_experience_years (float, 1 decimal)
      - total_experience_human (str)
    """
    cutoff = as_of or date.today()
    intervals: List[Tuple[date, date]] = []

    for item in exp_list or []:
        start_s = (item.get("start_date") or "").strip()
        end_s = (item.get("end_date") or "").strip()
        current = bool(item.get("current"))

        start_dt = _parse_date_fuzzy(start_s)
        end_dt = _parse_date_fuzzy(end_s)

        if current or _is_present(end_s) or end_dt is None:
            end_dt = cutoff

        if start_dt and end_dt:
            # clamp end to cutoff
            if end_dt > cutoff:
                end_dt = cutoff
            intervals.append((start_dt, end_dt))

    merged = _merge_intervals(intervals)
    if debug:
        print("\n[DEBUG] Experience intervals (merged):")
        for s, e in merged:
            print(f"  {s}  →  {e}")

    total_months = sum(_months_between(s, e) for s, e in merged)
    total_years = round(total_months / 12.0, 1)
    return {
        "total_experience_months": int(total_months),
        "total_experience_years": total_years,
        "total_experience_human": humanize_months(total_months),
    }

# --------------------------
# Gemini helpers
# --------------------------
def resolve_api_key(cli_key: Optional[str]) -> str:
    api_key = cli_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Enter your Gemini API key (starts with 'AIza...') — input hidden:")
        api_key = getpass.getpass("API key: ").strip()
    if not api_key:
        print("Error: No API key provided.", file=sys.stderr)
        sys.exit(1)
    return api_key

def list_models(api_key: str) -> None:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    print("Available models:")
    for m in genai.list_models():
        print(" -", m.name)

def pick_flash_model(api_key: str, preferred: str) -> str:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    names = [m.name for m in genai.list_models()]
    if preferred in names:
        return preferred
    candidates = [
        "models/gemini-1.5-flash-latest",
        "models/gemini-1.5-flash",
        "models/gemini-1.5-flash-8b-latest",
        "models/gemini-1.5-flash-8b",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b-latest",
        "gemini-1.5-flash-8b",
    ]
    available = set(names) | set(n.replace("models/", "") for n in names)
    for c in candidates:
        if c in available or ("models/" + c) in available:
            return c if c in names else ("models/" + c)
    for n in names:
        if "flash" in n:
            return n
    for c in ["models/gemini-1.5-pro-latest", "gemini-1.5-pro-latest"]:
        if c in available or ("models/" + c) in available:
            return c if c in names else ("models/" + c)
    raise RuntimeError("No suitable flash/pro model found. Use --list-models to see available models.")

def parse_with_gemini(text: str, api_key: str, model_name: str) -> Dict[str, Any]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)

    generation_config = {
        "temperature": 0,
        "response_mime_type": "application/json",
    }

    prompt = (
        SYSTEM_PROMPT
        + "\n\nJSON Schema:\n"
        + json.dumps(SCHEMA, indent=2)
        + "\n\nResume Text:\n"
        + text
    )

    # Try provided model; if it fails, auto-pick a flash model
    try:
        model = genai.GenerativeModel(model_name=model_name, generation_config=generation_config)
        resp = model.generate_content(prompt)
    except Exception:
        fallback = pick_flash_model(api_key, preferred="models/gemini-1.5-flash-latest")
        model = genai.GenerativeModel(model_name=fallback, generation_config=generation_config)
        resp = model.generate_content(prompt)

    content = getattr(resp, "text", None) or (resp.candidates[0].content.parts[0].text if getattr(resp, "candidates", None) else "")
    if not content:
        raise RuntimeError("Empty response from model.")
    try:
        return json.loads(content)
    except Exception:
        start = content.find("{")
        end = content.rfind("}") + 1
        if start == -1 or end == 0:
            raise RuntimeError(f"Model did not return JSON. Raw head: {content[:400]!r}")
        return json.loads(content[start:end])