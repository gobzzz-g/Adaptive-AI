from __future__ import annotations

import base64
import fitz
import io
import logging
import os
import pytesseract
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from openai import OpenAI
from PIL import Image
from pydantic import BaseModel, Field

from agent.base_agent import BaseAdaptiveAgent
from agent.skill_loader import SkillLoader, SkillNotFoundError
from agent.validator import InvalidSkillError, SkillValidator
from config.settings import get_settings

load_dotenv()


def configure_logging() -> None:
    settings = get_settings()
    log_path = Path(settings.log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    if not root_logger.handlers:
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root_logger.addHandler(stream_handler)
        root_logger.addHandler(file_handler)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    logging.getLogger(__name__).info("Adaptive AI Agent backend started")
    yield


app = FastAPI(
    title="Universal Adaptive AI Agent Backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()
skill_loader = SkillLoader(settings.skills_dir)
agent = BaseAdaptiveAgent(settings, skill_loader)

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("NVIDIA_API_KEY")
)

if os.name == "nt":
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def _normalize_base64_payload(payload: str) -> str:
    if not payload:
        return ""
    if "," in payload and "base64" in payload[:80].lower():
        return payload.split(",", 1)[1].strip()
    return payload.strip()


def _resolve_tesseract_cmd() -> str | None:
    tesseract_cmd = os.getenv("TESSERACT_CMD")
    if not tesseract_cmd:
        default_path = Path("C:/Program Files/Tesseract-OCR/tesseract.exe")
        if default_path.exists():
            tesseract_cmd = str(default_path)
    return tesseract_cmd


def extract_pdf_text(file_path: str) -> str:
    doc = fitz.open(file_path)
    full_text = ""
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text().strip()
        if len(text) > 100:
            full_text += text
        else:
            pix = page.get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            custom_config = r'--oem 3 --psm 6'
            text = pytesseract.image_to_string(
                        img, config=custom_config)
            full_text += f"\n{text}"
    doc.close()
    return full_text.strip()


def _extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        import fitz  # pymupdf
    except ImportError as exc:  # pragma: no cover
        raise ValueError("PDF support requires pymupdf. Install pymupdf to enable PDF uploads.") from exc
    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover
        raise ValueError("PDF OCR requires Pillow. Install pillow to enable OCR fallback.") from exc
    try:
        import pytesseract
        from pytesseract import TesseractNotFoundError
    except ImportError as exc:  # pragma: no cover
        raise ValueError("PDF OCR requires pytesseract and Tesseract OCR to be installed.") from exc

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Failed to read the PDF file. Please upload a valid PDF report.") from exc

    tesseract_cmd = _resolve_tesseract_cmd()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    full_text = ""
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        normal_text = page.get_text().strip()
        if len(normal_text) > 50:
            full_text += f"\n--- Page {page_num + 1} ---\n{normal_text}"
            continue

        try:
            pix = page.get_pixmap(dpi=300)
            img_bytes = pix.tobytes("png")
            with Image.open(io.BytesIO(img_bytes)) as image:
                ocr_text = pytesseract.image_to_string(image)
        except TesseractNotFoundError as exc:
            raise ValueError("Tesseract OCR is not installed. Install it to process PDF uploads.") from exc
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Failed to OCR the PDF page. Please upload a clearer report.") from exc

        full_text += f"\n--- Page {page_num + 1} (OCR) ---\n{ocr_text}"
    doc.close()
    return full_text.strip()


def _extract_image_text(image_bytes: bytes) -> str:
    try:
        from PIL import Image
    except ImportError as exc:  # pragma: no cover
        raise ValueError("Image support requires Pillow. Install pillow to enable image uploads.") from exc
    try:
        import pytesseract
        from pytesseract import TesseractNotFoundError
    except ImportError as exc:  # pragma: no cover
        raise ValueError("Image OCR requires pytesseract and Tesseract OCR to be installed.") from exc

    tesseract_cmd = _resolve_tesseract_cmd()
    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            text = pytesseract.image_to_string(image)
    except TesseractNotFoundError as exc:
        raise ValueError("Tesseract OCR is not installed. Install it to process image uploads.") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Failed to read the image file. Please upload a clear report image.") from exc

    text = text.strip()
    if not text:
        raise ValueError("No text detected in the image. Please upload a clearer report.")
    return text


def _extract_text_from_upload(file_name: str, file_content: str) -> str:
    if not file_content:
        raise ValueError("Uploaded file is empty.")

    suffix = Path(file_name).suffix.lower()
    if suffix == ".pdf" or suffix in SUPPORTED_IMAGE_EXTS:
        decoded = _normalize_base64_payload(file_content)
        try:
            raw_bytes = base64.b64decode(decoded, validate=True)
        except ValueError as exc:
            raise ValueError("Uploaded file data is not valid base64.") from exc

        if len(raw_bytes) > MAX_UPLOAD_BYTES:
            raise ValueError("Uploaded file is too large. Please upload a file under 8 MB.")

        if suffix == ".pdf":
            return _extract_pdf_text(raw_bytes)
        return _extract_image_text(raw_bytes)

    return file_content




def format_execution_output(raw_output: str) -> str:
    """Pass through the model's natural output after stripping conversational filler."""
    if not raw_output:
        return "No output was generated."
    text = raw_output.replace("\r", "").strip()
    text = re.sub(
        r"(?i)^(sure[,!.\s]+|certainly[,!.\s]+|absolutely[,!.\s]+|of course[,!.\s]+|let me |i will )",
        "", text,
    ).strip()
    return re.sub(r"\n{3,}", "\n\n", text).strip()


class RunAgentRequest(BaseModel):
    task: Optional[str] = Field(default=None, min_length=1, description="Task request")
    agent: Optional[str] = Field(default=None, min_length=1, description="Agent module name")
    user_input: Optional[str] = Field(default=None, min_length=1, description="Legacy alias for task request")
    skill: Optional[str] = Field(default=None, min_length=1, description="Legacy alias for agent module")
    file_name: Optional[str] = Field(default=None, description="Optional uploaded file name")
    file_content: Optional[str] = Field(default=None, description="Optional uploaded file content")


class RunAgentResponse(BaseModel):
    output: str
    skill_used: str


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail if isinstance(exc.detail, str) else "Request failed", "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "detail": exc.errors()},
    )


@app.post("/run-agent", response_model=RunAgentResponse)
async def run_agent(payload: RunAgentRequest) -> RunAgentResponse:
    try:
        task_request = (payload.task or payload.user_input or "").strip()
        selected_agent = (payload.agent or payload.skill or "").strip()

        if not task_request:
            raise ValueError("Task request is required")
        if not selected_agent:
            raise ValueError("Agent selection is required")

        normalized_file_content = payload.file_content
        if payload.file_name and payload.file_content:
            normalized_file_content = _extract_text_from_upload(
                payload.file_name,
                payload.file_content,
            )

        output = await agent.run(
            task_request,
            selected_agent,
            file_name=payload.file_name,
            file_content=normalized_file_content,
        )
        return RunAgentResponse(output=format_execution_output(output), skill_used=selected_agent)
    except SkillNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InvalidSkillError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).exception("Unexpected error in /run-agent")
        raise HTTPException(status_code=500, detail="Internal server error") from exc


@app.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):

    # Save uploaded file temporarily
    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    # Extract text using OCR
    report_text = extract_pdf_text(temp_path)

    # Clean up temp file
    os.remove(temp_path)

    # Validate extraction
    if not report_text or len(report_text) < 50:
        return {"error": "Could not extract text from PDF"}

    # Send to NVIDIA NIM
    response = client.chat.completions.create(
        model="meta/llama-3.1-8b-instruct",
        messages=[
            {
                "role": "system",
                "content": """You are a document analyst.
RULES:
- Use ONLY the text given to you
- Extract every name, number, table, result
- NEVER say details not provided
- NEVER say content unclear

Format:
### 📄 Document Type
### 📝 Summary
### ⚠️ Key Findings
### 📊 Data / Results
### 💡 Simple Explanation
### ⚠️ Note"""
            },
            {
                "role": "user",
                "content": f"Analyze this document:\n\n{report_text}"
            }
        ],
        temperature=0.1,
        max_tokens=1500,
    )

    return {"result": response.choices[0].message.content}


@app.get("/skills")
async def list_skills() -> dict[str, list[str]]:
    try:
        return {"skills": skill_loader.list_skills()}
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).exception("Failed to list skills")
        raise HTTPException(status_code=500, detail="Failed to list skills") from exc


@app.post("/upload-skill")
async def upload_skill(file: UploadFile = File(...)) -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    filename = Path(file.filename).name
    if not filename.lower().endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are allowed")

    content_bytes = await file.read()
    content = content_bytes.decode("utf-8", errors="ignore").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded skill file is empty")

    is_valid, errors = SkillValidator.validate_skill_content(content)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid skill file", "errors": errors},
        )

    try:
        skill_loader.save_skill_file(filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).exception("Failed to save uploaded skill")
        raise HTTPException(status_code=500, detail="Failed to upload skill") from exc

    return {"message": "Skill uploaded successfully", "skill": filename.removesuffix(".md")}


@app.delete("/delete-skill/{skill_name}")
async def delete_skill(skill_name: str) -> dict[str, str]:
    try:
        skill_loader.delete_skill(skill_name)
    except SkillNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logging.getLogger(__name__).exception("Failed to delete skill")
        raise HTTPException(status_code=500, detail="Failed to delete skill") from exc

    return {"message": "Skill deleted successfully", "skill": skill_name}
