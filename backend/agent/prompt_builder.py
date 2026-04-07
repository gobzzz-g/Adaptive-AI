from __future__ import annotations

import re
from typing import Optional


MAX_FILE_CONTENT_CHARS = 20000
OUTSIDE_ROLE_MESSAGE = "This task is outside my role."

UNIVERSAL_FORMAT = (
    "• Task Summary\n"
    "• Key Findings\n"
    "• AI Action / Solution\n"
    "• Execution / Output\n"
    "• Expected Outcome"
)

SYSTEM_INSTRUCTION = (
    "You are a strict, role-locked AI execution agent. "
    "You have ONE job defined by the ACTIVE SKILL FILE. "
    "MANDATORY RULES — follow EVERY rule without exception:\n"
    "1. ROLE CHECK FIRST — Before doing anything else, read the 'NOT IN SCOPE' "
    "section of the Active Skill File. "
    "If the user request matches ANY item in that list — even partially — "
    f"return EXACTLY: '{OUTSIDE_ROLE_MESSAGE}' and nothing else. STOP.\n"
    "2. CRITICAL: Do NOT attempt to handle the request in a creative or indirect way. "
    "If it is out of scope, the ONLY valid response is the exact rejection phrase.\n"
    "3. Your format must exactly match the Output Format section of your skill file.\n"
    "4. NO conversational text. NO filler. NO disclaimers.\n"
    "5. Treat input as a task. Respond like a business execution system."
)

# Agents that output plain email format (not universal 5-section)
EMAIL_AGENTS = {"email_outreach_agent"}

EMAIL_SYSTEM_INSTRUCTION = (
    "You are a professional business email writer. "
    "Your ONLY task is to write an email when the user explicitly asks you to "
    "write, compose, draft, or send an email.\n"
    "MANDATORY RULES:\n"
    "1. IN SCOPE: ONLY requests to write/compose/draft/send an email.\n"
    f"2. OUT OF SCOPE — return EXACTLY '{OUTSIDE_ROLE_MESSAGE}' for ANY of these:\n"
    "   - Requests to debug, fix, analyze, or review code\n"
    "   - Requests to analyze data or generate reports\n"
    "   - Requests to write blog posts, articles, or documentation\n"
    "   - Any request that does NOT explicitly ask to write an email\n"
    "3. If IN SCOPE — output ONLY the email using this EXACT format:\n"
    "   Subject: [short subject]\n\n"
    "   Dear [Recipient],\n\n"
    "   [1-2 lines: state the request clearly and directly]\n\n"
    "   [1 line: next step or closing action]\n\n"
    "   Thank you.\n\n"
    "   Regards,\n"
    "   [Name]\n"
    "4. Maximum 5-6 lines in the body — NO long paragraphs.\n"
    "5. NO section headers. NO 'Task Summary'. NO structured sections.\n"
    "6. NO filler text. ONE email only. ONE subject line only.\n"
    "CRITICAL: If the user sends code, data, or anything other than an email request "
    f"— respond ONLY with: {OUTSIDE_ROLE_MESSAGE}"
)


def _extract_output_format(skill_content: str) -> str:
    """Extract the ## Output Format section from a skill file."""
    match = re.search(
        r"^##\s+output format\s*$([\s\S]*?)(?:^##\s+|\Z)",
        skill_content.lower(),
        flags=re.MULTILINE,
    )
    if not match:
        return ""
    return match.group(1).strip()


def build_prompt(
    skill_content: str,
    user_input: str,
    skill_name: str = "",
    file_name: Optional[str] = None,
    file_content: Optional[str] = None,
) -> tuple[str, str]:
    """
    Returns (system_message, user_message).
    system_message → Ollama 'system' role (highest model priority).
    user_message   → Ollama 'user' role (skill content + input + directives).
    """
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
            "=== UPLOADED FILE ===\n"
            f"Filename: {safe_name}\n"
            f"{normalized_file_content}\n"
            "=== END FILE ===\n\n"
        )

    is_email_agent = skill_name in EMAIL_AGENTS
    system_msg = EMAIL_SYSTEM_INSTRUCTION if is_email_agent else SYSTEM_INSTRUCTION

    # Extract the output format from this specific skill for reinforcement
    output_format_block = _extract_output_format(skill_content)

    if is_email_agent:
        response_directive = (
            "=== RESPONSE DIRECTIVE ===\n"
            "Output ONLY a professional email.\n"
            "Format: Subject line, blank line, Dear [name], body (max 5-6 lines), "
            "Thank you, Regards, [Name].\n"
            "No section headers. No structured sections. No extra text.\n"
            f"If not an email task: {OUTSIDE_ROLE_MESSAGE}"
        )
    else:
        format_reminder = (
            f"\n=== REQUIRED OUTPUT FORMAT ===\n{output_format_block}\n==============================\n"
            if output_format_block else ""
        )
        response_directive = (
            "=== RESPONSE DIRECTIVE ===\n"
            f"{format_reminder}\n"
            "Provide the primary output directly. Do NOT output anything else if it is not requested.\n"
            f"If the request is strictly forbidden by the skill file, output exactly: {OUTSIDE_ROLE_MESSAGE}"
        )

    user_msg = (
        "=== ACTIVE SKILL ===\n"
        f"{skill_content.strip()}\n\n"
        f"{file_block}"
        "=== USER TASK ===\n"
        f"{user_input.strip()}\n\n"
        f"{response_directive}"
    )

    return system_msg, user_msg
