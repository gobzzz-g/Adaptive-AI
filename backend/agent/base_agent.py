from __future__ import annotations

import logging
from typing import Optional

from agent.llm import LLMClient
from agent.output_guard import enforce_output_policy
from agent.prompt_builder import build_prompt
from agent.skill_loader import SkillLoader
from agent.validator import SkillValidator
from config.settings import Settings


logger = logging.getLogger(__name__)


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
        skill_content = self.skill_loader.load_skill(skill_name)
        SkillValidator.ensure_valid_skill(skill_content)
        prompt = build_prompt(
            skill_content=skill_content,
            user_input=clean_input,
            file_name=file_name,
            file_content=file_content,
        )

        logger.info("Running agent with skill=%s provider=%s", skill_name, self.settings.llm_provider)
        output = await self.llm.run(prompt)
        output = enforce_output_policy(output)
        logger.info("Agent run completed for skill=%s", skill_name)
        return output
