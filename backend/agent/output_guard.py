from __future__ import annotations


OUTSIDE_ROLE_MESSAGE = "This task is outside my role."
MAX_OUTPUT_CHARS = 2200

REFUSAL_PHRASES = (
    "i am not able",
    "as an ai",
    "i cannot",
)


def enforce_output_policy(output: str) -> str:
    normalized = output.strip()
    if not normalized:
        return OUTSIDE_ROLE_MESSAGE

    lowered = normalized.lower()
    if OUTSIDE_ROLE_MESSAGE.lower() in lowered:
        return OUTSIDE_ROLE_MESSAGE

    if any(phrase in lowered for phrase in REFUSAL_PHRASES):
        return OUTSIDE_ROLE_MESSAGE

    if len(normalized) > MAX_OUTPUT_CHARS:
        return normalized[:MAX_OUTPUT_CHARS].rstrip()

    return normalized
