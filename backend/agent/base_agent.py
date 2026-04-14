from __future__ import annotations

import logging
from typing import Optional

from agent.llm import LLMClient
from agent.output_guard import enforce_output_policy
from agent.prompt_builder import build_prompt
from agent.role_filter import check_role_scope
from agent.skill_loader import SkillLoader
from agent.validator import SkillValidator
from config.settings import Settings


logger = logging.getLogger(__name__)

# Skills that require readable file content to function
FILE_DEPENDENT_SKILLS = {
    "healthcare_report_simplifier",
    "medical_report_simplifier",
}


class BaseAdaptiveAgent:
    def __init__(self, settings: Settings, skill_loader: SkillLoader):
        self.settings = settings
        self.skill_loader = skill_loader
        self.llm = LLMClient(settings)

    async def run(
        self,
        user_input: str,
        skill_name: str,
        file_name: Optional[str] = None,
        file_content: Optional[str] = None,
    ) -> str:
        clean_input = SkillValidator.sanitize_user_input(user_input)
        normalized_skill = skill_name.strip().lower()

        # Guard: file-dependent skills need readable content
        if normalized_skill in FILE_DEPENDENT_SKILLS and file_content is not None:
            normalized_content = file_content.strip()
            if not normalized_content or len(normalized_content) < 30:
                if (file_name or "").lower().endswith(".pdf"):
                    return (
                        "**File Read Error**\n\n"
                        "The uploaded PDF appears to be a scanned image with no extractable text. "
                        "Please use a text-selectable PDF, or paste the report text directly into the chat."
                    )
                return (
                    "**File Read Error**\n\n"
                    "The uploaded file appears to be empty or unreadable. "
                    "Please check the file and try again."
                )

        # Deterministic role scope check — reject before LLM if out of scope
        is_in_scope, rejection_msg = check_role_scope(skill_name, clean_input)
        if not is_in_scope:
            logger.info("Role scope rejected request for skill=%s", skill_name)
            return rejection_msg

        skill_content = self.skill_loader.load_skill(skill_name)
        SkillValidator.ensure_valid_skill(skill_content)
        system_msg, user_msg = build_prompt(
            skill_content=skill_content,
            user_input=clean_input,
            skill_name=skill_name,
            file_name=file_name,
            file_content=file_content,
        )

        logger.info("Running agent with skill=%s provider=%s", skill_name, self.settings.llm_provider)
        output = await self.llm.run(system_msg, user_msg)

        # Pass skill_name so output_guard can apply the correct character limit
        output = enforce_output_policy(output, skill_name=normalized_skill)
        logger.info("Agent run completed for skill=%s output_len=%d", skill_name, len(output))
        return output
