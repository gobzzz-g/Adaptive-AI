from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from agent.base_agent import BaseAdaptiveAgent
from agent.skill_loader import SkillLoader, SkillNotFoundError
from agent.validator import InvalidSkillError, SkillValidator
from config.settings import get_settings


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


class RunAgentRequest(BaseModel):
    user_input: str = Field(..., min_length=1, description="User prompt")
    skill: str = Field(..., min_length=1, description="Skill file name without .md")
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
        output = await agent.run(
            payload.user_input,
            payload.skill,
            file_name=payload.file_name,
            file_content=payload.file_content,
        )
        return RunAgentResponse(output=output, skill_used=payload.skill)
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
