from __future__ import annotations

from pathlib import Path


class SkillNotFoundError(FileNotFoundError):
    pass


class SkillLoader:
    def __init__(self, skills_dir: str):
        self.skills_dir = Path(skills_dir)
        self.skills_dir.mkdir(parents=True, exist_ok=True)

    def list_skills(self) -> list[str]:
        return sorted(path.stem for path in self.skills_dir.glob("*.md"))

    def load_skill(self, skill_name: str) -> str:
        self._validate_skill_name(skill_name)

        skill_path = self.skills_dir / f"{skill_name}.md"
        if not skill_path.exists() or not skill_path.is_file():
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        content = skill_path.read_text(encoding="utf-8").strip()
        if not content:
            raise SkillNotFoundError(f"Skill file is empty: {skill_name}")
        return content

    def delete_skill(self, skill_name: str) -> Path:
        self._validate_skill_name(skill_name)

        skill_path = self.skills_dir / f"{skill_name}.md"
        if not skill_path.exists() or not skill_path.is_file():
            raise SkillNotFoundError(f"Skill not found: {skill_name}")

        skill_path.unlink()
        return skill_path

    def save_skill_file(self, filename: str, content: str) -> Path:
        clean_name = Path(filename).name
        if clean_name != filename:
            raise ValueError("Unsafe filename")
        if not clean_name.lower().endswith(".md"):
            raise ValueError("Skill filename must end with .md")

        target_path = self.skills_dir / clean_name
        target_path.write_text(content.strip() + "\n", encoding="utf-8")
        return target_path

    @staticmethod
    def _validate_skill_name(skill_name: str) -> None:
        if not skill_name or any(sep in skill_name for sep in ("/", "\\", "..")):
            raise SkillNotFoundError("Invalid skill name")
