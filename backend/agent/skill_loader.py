from __future__ import annotations

from pathlib import Path


class SkillNotFoundError(FileNotFoundError):
    pass


class SkillLoader:
    def __init__(self, skills_dir: str):
        self.skills_dir = Path(skills_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

    def list_skills(self) -> list[str]:
        names: list[str] = []
        for path in self.skills_dir.glob("*.md"):
            normalized = self._normalize_skill_name(path.stem)
            if not normalized:
                continue
            if normalized not in names:
                names.append(normalized)
        return sorted(names)

    def load_skill(self, skill_name: str) -> str:
        self._validate_skill_name(skill_name)

        skill_path = self._resolve_skill_path(skill_name)
        if not skill_path:
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        content = skill_path.read_text(encoding="utf-8").strip()
        if not content:
            raise SkillNotFoundError(f"Skill file is empty: {skill_name}")
        return content

    def delete_skill(self, skill_name: str) -> Path:
        self._validate_skill_name(skill_name)

        skill_path = self._resolve_skill_path(skill_name)
        if not skill_path:
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        skill_path.unlink()
        return skill_path

    def save_skill_file(self, filename: str, content: str) -> Path:
        clean_name = Path(filename).name
        if clean_name != filename:
            raise ValueError("Unsafe filename")
        if not clean_name.lower().endswith(".md"):
            raise ValueError("Skill filename must end with .md")

        stem = Path(clean_name).stem.strip()
        if not stem:
            raise ValueError("Skill filename must include a name")
        normalized_name = f"{stem}.md"

        target_path = self.skills_dir / normalized_name
        target_path.write_text(content.strip() + "\n", encoding="utf-8")
        return target_path

    def _resolve_skill_path(self, skill_name: str) -> Path | None:
        normalized = self._normalize_skill_name(skill_name)
        if not normalized:
            return None

        direct_path = self.skills_dir / f"{normalized}.md"
        if direct_path.exists() and direct_path.is_file():
            return direct_path

        for path in self.skills_dir.glob("*.md"):
            if self._normalize_skill_name(path.stem) == normalized:
                return path

        return None

    @staticmethod
    def _normalize_skill_name(skill_name: str) -> str:
        return skill_name.strip()

    @staticmethod
    def _validate_skill_name(skill_name: str) -> None:
        normalized = skill_name.strip()
        if not normalized or any(sep in normalized for sep in ("/", "\\", "..")):
            raise SkillNotFoundError("Invalid skill name")
