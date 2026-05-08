from __future__ import annotations

import asyncio
import logging
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# ── Paths ──────────────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = BASE_DIR / "logs" / "executions"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

# Persistent Chrome user-data lives here.  A sub-directory of the backend so
# that it survives restarts and is easy to locate / wipe manually.
DEFAULT_PROFILE_DIR = BASE_DIR / "user_data"

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

ALLOWED_ACTIONS = {
    "goto",
    "click",
    "fill",
    "press",
    "wait_for_timeout",
    "wait_for_selector",
    "select_option",
    "screenshot",
    "hover",
    "check",
    "uncheck",
}

MAX_STEPS = 40
MAX_WAIT_MS = 60_000
DEFAULT_TIMEOUT_MS = 30_000

# ── Gmail-specific ─────────────────────────────────────────────────────────────

GMAIL_COMPOSE_SELECTOR = "div[role='button'][gh='cm']"
GMAIL_LOGIN_SELECTOR   = "input[type='email']"   # Google sign-in e-mail field

# How long to wait for the inbox OR login screen to appear after opening Gmail.
# Gmail is a heavy SPA; slow connections or cold starts can easily take 30-60 s.
GMAIL_GUARD_TIMEOUT_MS = 120_000   # 2 minutes

# Give the user up to 5 minutes to complete manual login
AUTH_LOGIN_WAIT_MS = 300_000

# ── Chrome launch settings ─────────────────────────────────────────────────────

# Chrome launch args that defeat Google's automation-detection heuristics
SAFE_CHROME_ARGS = [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
    # Suppress the info-bar "Chrome is being controlled by automated test software"
    "--disable-infobars",
    # Avoid GPU / sandbox issues in some Windows environments
    "--no-sandbox",
    "--disable-dev-shm-usage",
    # Skip Chrome first-run wizard and default-browser prompt (cleaner startup)
    "--no-first-run",
    "--no-default-browser-check",
]

# Playwright injects --enable-automation by default; remove it so Google does
# not flag the session as a bot.
IGNORED_DEFAULT_ARGS = ["--enable-automation"]

# Realistic human-like settings
SLOW_MO_MS = 150   # milliseconds between each Playwright action (mimics human speed)

# Viewport matching a common 1366×768 laptop display
BROWSER_VIEWPORT = {"width": 1366, "height": 768}

# User-agent string matching a real Chrome 135 on Windows 10
CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)


# ── Pydantic model ─────────────────────────────────────────────────────────────

class PlaywrightExecutionError(RuntimeError):
    pass


class PlaywrightStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(..., min_length=1)
    url: str | None = None
    selector: str | None = None
    text: str | None = None
    key: str | None = None
    ms: int | None = None
    value: str | list[str] | None = None
    path: str | None = None
    timeout_ms: int | None = None


# ── Validation helpers ─────────────────────────────────────────────────────────

def _validate_url(url: str, step_index: int) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise PlaywrightExecutionError(
            f"Step {step_index} goto requires an http/https URL"
        )
    return url


def _safe_filename(name: str, step_index: int) -> str:
    clean = Path(name).name
    if not clean or clean != name:
        raise PlaywrightExecutionError(
            f"Step {step_index} screenshot path must be a simple filename"
        )
    return clean


def _normalize_timeout(value: int | None, step_index: int, default_timeout: int) -> int:
    if value is None:
        return default_timeout
    if value < 1000 or value > MAX_WAIT_MS:
        raise PlaywrightExecutionError(
            f"Step {step_index} timeout_ms must be between 1000 and {MAX_WAIT_MS}"
        )
    return value


def _validate_steps(steps: list[PlaywrightStep]) -> None:
    if not steps:
        raise PlaywrightExecutionError("No steps provided")
    if len(steps) > MAX_STEPS:
        raise PlaywrightExecutionError(f"Too many steps (max {MAX_STEPS})")

    for idx, step in enumerate(steps, start=1):
        action = step.action.strip().lower()
        if action not in ALLOWED_ACTIONS:
            raise PlaywrightExecutionError(
                f"Step {idx} has unsupported action '{step.action}'"
            )
        if action == "goto" and not step.url:
            raise PlaywrightExecutionError(f"Step {idx} goto requires url")
        if action in {"click", "fill", "press", "wait_for_selector", "select_option",
                      "hover", "check", "uncheck"}:
            if not step.selector:
                raise PlaywrightExecutionError(
                    f"Step {idx} {action} requires selector"
                )
        if action == "fill" and step.text is None:
            raise PlaywrightExecutionError(f"Step {idx} fill requires text")
        if action == "press" and not step.key:
            raise PlaywrightExecutionError(f"Step {idx} press requires key")
        if action == "wait_for_timeout":
            if step.ms is None or step.ms <= 0 or step.ms > MAX_WAIT_MS:
                raise PlaywrightExecutionError(
                    f"Step {idx} wait_for_timeout requires ms between 1 and {MAX_WAIT_MS}"
                )
        if action == "select_option" and step.value is None:
            raise PlaywrightExecutionError(
                f"Step {idx} select_option requires value"
            )


# ── Browser helpers ────────────────────────────────────────────────────────────

def _refresh_page(context, current_page, timeout_ms: int):
    """
    Return the most recently active live page in *context*.
    Useful after a goto that causes Gmail (or any SPA) to swap tabs or redirect,
    leaving the original `page` reference stale / closed.
    """
    try:
        if not current_page.is_closed():
            return current_page
    except Exception:
        pass

    try:
        live = [p for p in context.pages if not p.is_closed()]
    except Exception:
        live = []

    if not live:
        raise PlaywrightExecutionError(
            "All browser tabs were closed unexpectedly. "
            "Please keep the Chrome window open while a workflow is running."
        )

    page = live[-1]
    page.set_default_timeout(timeout_ms)
    page.set_default_navigation_timeout(timeout_ms)
    return page


def _launch_persistent_context(playwright, profile_dir: Path):
    """
    Launch real Google Chrome with a persistent user-data directory.

    Key anti-detection measures applied here:
    - channel="chrome"                         → uses installed Chrome, not Chromium
    - headless=False                           → visible browser; Google rejects headless
    - ignore_default_args=["--enable-automation"] → removes Playwright's bot flag
    - --disable-blink-features=AutomationControlled → hides navigator.webdriver flag
    - --start-maximized                        → looks like a regular desktop browser
    - --disable-infobars                       → no "controlled by software" bar
    - slow_mo=150                              → human-like pacing between actions
    - user_agent                               → real Chrome 135 UA string
    - viewport=BROWSER_VIEWPORT               → realistic 1366×768 screen
    """
    profile_dir.mkdir(parents=True, exist_ok=True)
    try:
        return playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            channel="chrome",                    # REAL Chrome, not bundled Chromium
            headless=False,                      # must be visible — Google rejects headless
            slow_mo=SLOW_MO_MS,                  # human-like action pacing
            args=SAFE_CHROME_ARGS,
            ignore_default_args=IGNORED_DEFAULT_ARGS,
            viewport=BROWSER_VIEWPORT,           # realistic laptop screen size
            user_agent=CHROME_USER_AGENT,        # real Chrome 135 Windows UA string
        )
    except Exception as exc:
        raise PlaywrightExecutionError(
            "Failed to launch Chrome with a persistent profile. "
            "Make sure Google Chrome is installed, close any other Chrome instances "
            "that share this profile, and retry."
        ) from exc


def _get_context_page(context):
    """Return the first open page, or open a new one."""
    if context.pages:
        return context.pages[0]
    return context.new_page()


def _delete_user_data_dir(profile_dir: Path) -> None:
    """Wipe the persistent profile directory (manual recovery path only)."""
    if not profile_dir.exists():
        return
    if not profile_dir.is_dir():
        raise PlaywrightExecutionError(
            "Configured user_data_dir is not a directory."
        )
    shutil.rmtree(profile_dir, ignore_errors=True)
    logger.info("Deleted user_data directory: %s", profile_dir)


# ── Gmail helpers ──────────────────────────────────────────────────────────────

def _is_gmail_compose_selector(selector: str | None) -> bool:
    if not selector:
        return False
    lowered = selector.strip().lower()
    return "gh='cm'" in lowered or "gh=\"cm\"" in lowered or "gh=cm" in lowered


def _capture_debug_snapshot(page, label: str) -> None:
    """Save a screenshot + DOM snapshot and log the current URL to diagnose Gmail load failures."""
    try:
        current_url = page.url
        logger.warning("%s | Current URL: %s", label, current_url)
        snap_path = ARTIFACT_DIR / f"gmail_debug_{int(time.time() * 1000)}.png"
        page.screenshot(path=str(snap_path), full_page=True)
        logger.warning("Debug screenshot saved: %s", snap_path)
        dom_path = ARTIFACT_DIR / f"gmail_dom_{int(time.time() * 1000)}.html"
        dom_path.write_text(page.content(), encoding="utf-8")
        logger.warning("DOM snapshot saved: %s", dom_path)
    except Exception:
        logger.warning("Could not capture debug snapshot.", exc_info=True)


def _wait_for_network_idle(page, timeout_ms: int) -> None:
    """
    Best-effort networkidle wait — never raises.
    networkidle is not guaranteed on SPAs with long-polling (like Gmail),
    so we cap it at 30 s and continue regardless.
    """
    try:
        page.wait_for_load_state("networkidle", timeout=min(timeout_ms, 30_000))
    except Exception:
        pass


# ── Gmail login guard ──────────────────────────────────────────────────────────

def _ensure_gmail_session(
    playwright,
    context,
    page,
    profile_dir: Path,
    timeout_ms: int,
) -> tuple:
    """
    Ensure the Gmail inbox is visible before proceeding with automation.

    Flow
    ----
    1. Wait for the network to become idle (best-effort, capped at 30 s).
    2. Dynamically wait up to GMAIL_GUARD_TIMEOUT_MS (2 min) for either:
       a. "Compose" button → already logged in; return immediately.
       b. Sign-in e-mail field → login required.
    3. If login required:
       - Wait up to AUTH_LOGIN_WAIT_MS (5 min) for the user to log in manually.
       - Once the Compose button appears, return.
    4. If neither element appears after the full timeout:
       - Capture a debug screenshot + log the current URL.
       - Retry once after another networkidle wait.
       - Raise a meaningful error on the second failure.
    5. We NEVER auto-delete user_data — session persistence is critical.

    Returns
    -------
    (context, page)
    """
    # Use at least GMAIL_GUARD_TIMEOUT_MS regardless of the step-level timeout,
    # so a short step timeout doesn't prematurely kill the inbox wait.
    guard_timeout = max(timeout_ms, GMAIL_GUARD_TIMEOUT_MS)

    for attempt in range(2):
        # Let the SPA settle before querying the DOM
        _wait_for_network_idle(page, guard_timeout)

        try:
            page.wait_for_selector(
                f"{GMAIL_COMPOSE_SELECTOR}, {GMAIL_LOGIN_SELECTOR}",
                timeout=guard_timeout,
            )
        except Exception:
            _capture_debug_snapshot(page, "Gmail selector wait timed out")
            if attempt == 0:
                logger.info("Retrying Gmail inbox detection after networkidle...")
                _wait_for_network_idle(page, guard_timeout)
                continue
            raise PlaywrightExecutionError(
                "Gmail did not load within 2 minutes. "
                "Check your internet connection. "
                "A debug screenshot has been saved to the logs/executions directory."
            )

        # ── Inbox already open ─────────────────────────────────────────────────
        compose_el = page.query_selector(GMAIL_COMPOSE_SELECTOR)
        if compose_el and compose_el.is_visible():
            logger.info("Gmail inbox confirmed — session is valid.")
            return context, page

        # ── Login required ─────────────────────────────────────────────────────
        login_el = page.query_selector(GMAIL_LOGIN_SELECTOR)
        if login_el and login_el.is_visible():
            logger.info(
                "Gmail login screen detected. Waiting up to %d seconds for manual login.",
                AUTH_LOGIN_WAIT_MS // 1000,
            )
            try:
                page.wait_for_selector(
                    GMAIL_COMPOSE_SELECTOR,
                    timeout=AUTH_LOGIN_WAIT_MS,
                )
            except Exception as exc:
                _capture_debug_snapshot(page, "Gmail login timed out")
                raise PlaywrightExecutionError(
                    "Login not completed within 5 minutes. "
                    "Please sign into Gmail in the Chrome window, then run the workflow again. "
                    "If Google shows 'This browser may not be secure', delete the "
                    f"'{profile_dir}' directory and re-run — Chrome will open fresh for login."
                ) from exc
            logger.info("Gmail login completed successfully.")
            return context, page

        # ── Neither element visible yet; retry once ────────────────────────────
        if attempt == 0:
            logger.info(
                "Compose and login not yet visible — waiting for network idle and retrying."
            )
            _wait_for_network_idle(page, guard_timeout)
            continue

        _capture_debug_snapshot(page, "Gmail inbox: Compose button not found")
        raise PlaywrightExecutionError(
            "Gmail loaded but the Compose button is not visible. "
            "Make sure you are fully logged into Gmail in the Chrome window."
        )

    return context, page


# ── Main executor ──────────────────────────────────────────────────────────────

def run_playwright_steps(
    steps: list[PlaywrightStep],
    headless: bool = False,            # always forced to headed — kept for API compat
    timeout_ms: int = DEFAULT_TIMEOUT_MS,
    user_data_dir: str | None = None,  # persistent Chrome user-data directory
    cdp_url: str | None = None,        # unused — no CDP; kept for API compat
) -> dict[str, Any]:
    """
    Execute a list of Playwright steps using real Chrome with a persistent
    user profile so that Google login is preserved across runs.

    Anti-detection strategy
    -----------------------
    • channel="chrome"                    → real installed Chrome (not Chromium)
    • headless=False                      → visible browser
    • --disable-blink-features=...        → hides navigator.webdriver
    • ignore_default_args removes         → --enable-automation (detected by Google)
    • Persistent user_data_dir            → cookies / session survive restarts
    • navigator.webdriver init script     → extra JS-level mask
    • slow_mo=150                         → human-like action pacing
    • realistic viewport + user_agent     → mimics a normal desktop session

    Gmail loading strategy
    ----------------------
    • wait_until="domcontentloaded"       → faster than "load" for SPAs
    • _wait_for_network_idle()            → lets Gmail's JS settle before querying DOM
    • _ensure_gmail_session()             → dynamically waits for Compose / login element
    • 2-minute guard timeout              → patient wait for slow connections
    • debug screenshot on failure         → saves to logs/executions/ for diagnosis
    """
    _validate_steps(steps)

    profile_dir = Path(user_data_dir) if user_data_dir else DEFAULT_PROFILE_DIR

    start = time.monotonic()
    actions_log: list[dict[str, Any]] = []
    artifacts: list[str] = []

    with sync_playwright() as p:
        # ── Launch Chrome with persistent profile ──────────────────────────────
        context = _launch_persistent_context(p, profile_dir)

        # Extra JS-level mask: hide navigator.webdriver in every new page/frame.
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        page = _get_context_page(context)
        page.set_default_timeout(timeout_ms)
        page.set_default_navigation_timeout(timeout_ms)

        idx = 0
        action = ""

        def run_with_retry(step_idx: int, action_name: str, selector: str | None, fn) -> None:
            try:
                fn()
            except PlaywrightTimeoutError as exc:
                if not selector:
                    raise
                logger.info(
                    "Step %d timed out during %s — refreshing page reference and retrying.",
                    step_idx, action_name,
                )
                nonlocal page
                page = _refresh_page(context, page, timeout_ms)
                _wait_for_network_idle(page, timeout_ms)
                fn()

        try:
            for idx, step in enumerate(steps, start=1):
                action = step.action.strip().lower()
                step_timeout = _normalize_timeout(step.timeout_ms, idx, timeout_ms)

                # Always re-acquire the live page (Gmail may have opened a new tab)
                page = _refresh_page(context, page, timeout_ms)

                logger.info("Step %d: %s", idx, action)

                # ── goto ───────────────────────────────────────────────────────
                if action == "goto":
                    url = _validate_url(step.url or "", idx)
                    try:
                        # Use domcontentloaded instead of load: Gmail fires
                        # DOMContentLoaded quickly but "load" can hang on ads/trackers.
                        page.goto(url, wait_until="domcontentloaded", timeout=step_timeout)
                    except Exception:
                        page = _refresh_page(context, page, timeout_ms)
                        try:
                            page.wait_for_load_state("domcontentloaded", timeout=step_timeout)
                        except Exception:
                            pass  # best-effort; continue to next step

                    # For Gmail: wait for network idle, then confirm inbox/login
                    if "mail.google.com" in (step.url or ""):
                        _wait_for_network_idle(page, step_timeout)
                        context, page = _ensure_gmail_session(
                            p,
                            context,
                            page,
                            profile_dir,
                            step_timeout,
                        )

                # ── click ──────────────────────────────────────────────────────
                elif action == "click":
                    selector = step.selector or ""

                    def _click() -> None:
                        nonlocal context, page
                        # If clicking Compose on Gmail, first confirm the session
                        if _is_gmail_compose_selector(selector) and "mail.google.com" in page.url:
                            context, page = _ensure_gmail_session(
                                p,
                                context,
                                page,
                                profile_dir,
                                step_timeout,
                            )
                        page.locator(selector).click(timeout=step_timeout)

                    run_with_retry(idx, action, selector, _click)

                # ── fill ───────────────────────────────────────────────────────
                elif action == "fill":
                    selector = step.selector or ""

                    def _fill() -> None:
                        page.locator(selector).fill(step.text or "", timeout=step_timeout)

                    run_with_retry(idx, action, selector, _fill)

                # ── press ──────────────────────────────────────────────────────
                elif action == "press":
                    selector = step.selector or ""

                    def _press() -> None:
                        page.locator(selector).press(step.key or "", timeout=step_timeout)

                    run_with_retry(idx, action, selector, _press)

                # ── wait_for_selector ──────────────────────────────────────────
                elif action == "wait_for_selector":
                    selector = step.selector or ""

                    def _wait_for_selector() -> None:
                        nonlocal context, page
                        # For the Compose selector on Gmail, use the session guard
                        if _is_gmail_compose_selector(selector) and "mail.google.com" in page.url:
                            context, page = _ensure_gmail_session(
                                p,
                                context,
                                page,
                                profile_dir,
                                step_timeout,
                            )
                            return
                        page.wait_for_selector(selector, timeout=step_timeout)

                    run_with_retry(idx, action, selector, _wait_for_selector)

                # ── wait_for_timeout ───────────────────────────────────────────
                elif action == "wait_for_timeout":
                    page.wait_for_timeout(step.ms or 0)

                # ── select_option ──────────────────────────────────────────────
                elif action == "select_option":
                    selector = step.selector or ""

                    def _select() -> None:
                        page.select_option(selector, value=step.value, timeout=step_timeout)

                    run_with_retry(idx, action, selector, _select)

                # ── hover ──────────────────────────────────────────────────────
                elif action == "hover":
                    selector = step.selector or ""

                    def _hover() -> None:
                        page.locator(selector).hover(timeout=step_timeout)

                    run_with_retry(idx, action, selector, _hover)

                # ── check ──────────────────────────────────────────────────────
                elif action == "check":
                    selector = step.selector or ""

                    def _check() -> None:
                        page.locator(selector).check(timeout=step_timeout)

                    run_with_retry(idx, action, selector, _check)

                # ── uncheck ────────────────────────────────────────────────────
                elif action == "uncheck":
                    selector = step.selector or ""

                    def _uncheck() -> None:
                        page.locator(selector).uncheck(timeout=step_timeout)

                    run_with_retry(idx, action, selector, _uncheck)

                # ── screenshot ─────────────────────────────────────────────────
                elif action == "screenshot":
                    filename = _safe_filename(step.path or "", idx) if step.path else None
                    if not filename:
                        filename = f"screenshot_{int(time.time() * 1000)}.png"
                    target = ARTIFACT_DIR / filename
                    page.screenshot(path=str(target), full_page=True)
                    artifacts.append(str(target))

                actions_log.append({"step": idx, "action": action, "status": "ok"})

        except PlaywrightTimeoutError as exc:
            raise PlaywrightExecutionError(
                f"Step {idx} timed out during {action}"
            ) from exc
        except PlaywrightExecutionError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PlaywrightExecutionError(
                f"Step {idx} failed during {action}: {exc}"
            ) from exc
        finally:
            pass  # Playwright manages browser cleanup via the context manager

    duration_ms = int((time.monotonic() - start) * 1000)
    return {
        "status": "success",
        "executed_steps": len(actions_log),
        "duration_ms": duration_ms,
        "actions": actions_log,
        "artifacts": artifacts,
    }
