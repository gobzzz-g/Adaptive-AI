from __future__ import annotations

import re


class InvalidSkillError(ValueError):
    pass


class SkillValidator:
    REQUIRED_SECTIONS = ["objective", "skills", "process", "output format"]
    INJECTION_PATTERNS = [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"reveal\s+(your\s+)?system\s+prompt",
        r"developer\s+mode",
        r"jailbreak",
        r"bypass\s+safety",
    ]

    @classmethod
    def validate_skill_content(cls, skill_content: str) -> tuple[bool, list[str]]:
        errors: list[str] = []
        lowered = skill_content.lower()

        for section in cls.REQUIRED_SECTIONS:
            pattern = rf"^##\s+{re.escape(section)}\s*$"
            if not re.search(pattern, lowered, flags=re.MULTILINE):
                errors.append(f"Missing required section: {section.title()}")

        if "# agent role" not in lowered:
            errors.append("Missing required top heading: Agent Role")

        return len(errors) == 0, errors

    @classmethod
    def ensure_valid_skill(cls, skill_content: str) -> None:
        is_valid, errors = cls.validate_skill_content(skill_content)
        if not is_valid:
            raise InvalidSkillError("; ".join(errors))

    @classmethod
    def sanitize_user_input(cls, user_input: str) -> str:
        cleaned = user_input.strip()
        for pattern in cls.INJECTION_PATTERNS:
            cleaned = re.sub(pattern, "[filtered]", cleaned, flags=re.IGNORECASE)
        return cleaned
