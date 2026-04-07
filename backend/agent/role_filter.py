"""
role_filter.py — Deterministic scope check before the LLM is called.

Defines IN-SCOPE keyword sets for each known agent.
If the user input matches NONE of the in-scope keywords,
the query is rejected immediately without calling the LLM.
"""
from __future__ import annotations

REJECTION_MESSAGE = "This is not valid for my role."

# Each agent has a list of keywords that indicate an IN-SCOPE request.
# If the input contains at least ONE of these, the LLM is called.
# If it contains NONE, the query is rejected immediately.
ROLE_SCOPES: dict[str, list[str]] = {
    "email_outreach_agent": [
        "email", "mail", "write to", "send to", "compose", "draft",
        "letter", "message to", "subject:", "dear ", "regards",
        "outreach", "follow up", "follow-up", "notify", "inform",
        "request leave", "leave request", "sick leave", "apply for leave",
        "apology", "thank you", "introduction", "meeting request",
    ],
    "code_debug_agent": [
        "code", "debug", "error", "bug", "fix", "function", "syntax",
        "python", "java", "javascript", "typescript", "def ", "class ",
        "import ", "program", "script", "variable", "loop", "exception",
        "traceback", "compile", "runtime", "logic error", "output:",
        "range(", "print(", "return ", "if ", "for ", "while ",
        "numbers =", "total =", "average",
    ],
    "content_writer": [
        "write", "blog", "article", "post", "content", "caption",
        "social media", "marketing", "copywriting", "headline", "copy",
        "ad ", "advertisement", "landing page", "newsletter", "seo",
        "product description", "tagline", "slogan", "brand voice",
    ],
    "data_analyst": [
        "data", "analyz", "analysis", "metric", "revenue", "sales",
        "chart", "trend", "report", "statistic", "number", "percentage",
        "growth", "decline", "kpi", "dashboard", "performance",
        "segment", "cohort", "funnel", "conversion", "roi",
        "spreadsheet", "dataset", "csv", "column", "row",
    ],
    "healthcare_revenue_agent": [
        "healthcare", "hospital", "clinic", "patient", "billing",
        "revenue cycle", "insurance", "claim", "denial", "reimbursement",
        "medical", "physician", "ehr", "icd", "cpt", "prior authorization",
        "ar days", "collection rate", "outstanding balance", "payer",
        "healthcare revenue", "revenue leakage", "cost optimization",
    ],
}


def check_role_scope(skill_name: str, user_input: str) -> tuple[bool, str]:
    """
    Returns (is_in_scope, rejection_message).
    If the skill is unknown or has no scope defined, allows the LLM to decide.
    """
    scope_keywords = ROLE_SCOPES.get(skill_name.lower())
    if not scope_keywords:
        # Unknown or custom skill — let the LLM decide
        return True, ""

    input_lower = user_input.lower()
    if any(kw in input_lower for kw in scope_keywords):
        return True, ""

    return False, REJECTION_MESSAGE
