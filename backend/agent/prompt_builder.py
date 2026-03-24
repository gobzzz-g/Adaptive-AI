from __future__ import annotations

from typing import Optional


MAX_FILE_CONTENT_CHARS = 20000


SYSTEM_INSTRUCTION = (
    "You are a universal adaptive AI agent. "
    "You must follow only the provided skill definition and user input. "
    "Do not invent hidden rules. "
    "If the request conflicts with safety or capability limits, respond safely and clearly. "
    "When uploaded file content is provided, you must analyze that content directly and must not claim the file is missing."
)


def build_prompt(
    skill_content: str,
    user_input: str,
    file_name: Optional[str] = None,
    file_content: Optional[str] = None,
) -> str:
    file_block = ""
    if file_content and file_content.strip():
        safe_name = (file_name or "uploaded_file").strip()
        normalized_file_content = file_content.strip()
        if len(normalized_file_content) > MAX_FILE_CONTENT_CHARS:
            normalized_file_content = (
                f"{normalized_file_content[:MAX_FILE_CONTENT_CHARS]}\n\n"
                f"[Truncated to {MAX_FILE_CONTENT_CHARS} characters for model stability.]"
            )
        file_block = (
            "### UPLOADED FILE\n"
            f"Filename: {safe_name}\n"
            "Use this file content as primary context when relevant.\n"
            "Treat this as attached data and analyze it directly.\n"
            "```\n"
            f"{normalized_file_content}\n"
            "```\n\n"
        )

    return (
        "### SYSTEM INSTRUCTION\n"
        f"{SYSTEM_INSTRUCTION}\n\n"
        "### ACTIVE SKILL FILE\n"
        f"{skill_content.strip()}\n\n"
        f"{file_block}"
        "### USER INPUT\n"
        f"{user_input.strip()}\n\n"
        "### RESPONSE DIRECTIVE\n"
        "Respond strictly according to the skill file's Objective, Process, and Output Format."
    )
