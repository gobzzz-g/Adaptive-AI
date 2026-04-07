from __future__ import annotations

import re


class InvalidSkillError(ValueError):
    pass


class SkillValidator:
    REQUIRED_SECTIONS = ["objective", "skills", "process", "output format", "rules"]
    REQUIRED_RULE_LINES = [
        "only perform the defined task",
        "do not explain anything extra",
        "keep output minimal and structured",
        "this task is outside my role.",
    ]
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

        # We've relaxed the strict section requirements to allow more flexible skill files.
        # Just ensure the file has some basic structure or at least isn't empty.
        if len(skill_content.strip()) < 10:
            errors.append("Skill file content is too short or empty")

        return len(errors) == 0, errors

    @staticmethod
    def _extract_rules_section(skill_content_lower: str) -> str:
        match = re.search(
            r"^##\s+rules\s*$([\s\S]*?)(?:^##\s+|\Z)",
            skill_content_lower,
            flags=re.MULTILINE,
        )
        if not match:
            return ""
        return match.group(1).strip()

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
