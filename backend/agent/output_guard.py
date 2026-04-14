from __future__ import annotations

# Agents that produce structured, long-form output and must NOT be truncated
LONG_FORM_SKILLS = {
    "medical_report_simplifier",
    "healthcare_report_simplifier",
    "data_analyst",
}

OUTSIDE_ROLE_MESSAGE = "This task is outside my role."

# Default max for all agents
MAX_OUTPUT_CHARS = 2200

# Raised limit for structured/long-form agents
MAX_OUTPUT_CHARS_LONG = 12000

REFUSAL_PHRASES = (
    "i am not able",
    "as an ai",
    "i cannot",
)


def enforce_output_policy(output: str, skill_name: str = "") -> str:
    normalized = output.strip()
    if not normalized:
        return OUTSIDE_ROLE_MESSAGE

    lowered = normalized.lower()
    if OUTSIDE_ROLE_MESSAGE.lower() in lowered:
        return OUTSIDE_ROLE_MESSAGE

    if any(phrase in lowered for phrase in REFUSAL_PHRASES):
        return OUTSIDE_ROLE_MESSAGE

    # Use higher limit for long-form agents
    limit = (
        MAX_OUTPUT_CHARS_LONG
        if skill_name.strip().lower() in LONG_FORM_SKILLS
        else MAX_OUTPUT_CHARS
    )

    if len(normalized) > limit:
        return normalized[:limit].rstrip() + "\n\n[Output truncated — result exceeded maximum length]"

    return normalized
