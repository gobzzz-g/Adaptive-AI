from __future__ import annotations

from typing import Optional


MAX_FILE_CONTENT_CHARS = 20000
OUTSIDE_ROLE_MESSAGE = "This task is outside my role."


SYSTEM_INSTRUCTION = (
    "You are a strict role-based AI agent. "
    "ONLY perform the task defined in the active skill file. "
    "DO NOT explain your role. "
    "DO NOT add introductions, conversational text, or polite filler. "
    "DO NOT include disclaimers. "
    "KEEP responses short, direct, and structured. "
    f"If the task is outside the active skill, respond EXACTLY with: {OUTSIDE_ROLE_MESSAGE} "
    "When uploaded file content is provided, analyze that content directly and do not claim the file is missing."
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
        "Follow the active skill's Objective, Process, Output Format, and Rules exactly. "
        "Output only the final answer content in the required structure. "
        "Do not add any text outside the required output format. "
        f"If irrelevant to the active skill, return exactly: {OUTSIDE_ROLE_MESSAGE}"
    )
