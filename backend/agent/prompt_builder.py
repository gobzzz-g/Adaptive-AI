from __future__ import annotations


SYSTEM_INSTRUCTION = (
    "You are a universal adaptive AI agent. "
    "You must follow only the provided skill definition and user input. "
    "Do not invent hidden rules. "
    "If the request conflicts with safety or capability limits, respond safely and clearly."
)


def build_prompt(skill_content: str, user_input: str) -> str:
    return (
        "### SYSTEM INSTRUCTION\n"
        f"{SYSTEM_INSTRUCTION}\n\n"
        "### ACTIVE SKILL FILE\n"
        f"{skill_content.strip()}\n\n"
        "### USER INPUT\n"
        f"{user_input.strip()}\n\n"
        "### RESPONSE DIRECTIVE\n"
        "Respond strictly according to the skill file's Objective, Process, and Output Format."
    )
