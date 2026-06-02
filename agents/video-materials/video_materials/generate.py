"""Generate the brief with the Claude Code subscription — never the paid API.

We shell out to `claude -p` and let it use your **already logged-in Claude Code
session** (Pro/Max). No OAuth token is injected — just run `claude` once
interactively to log in, and the runner reuses that session.

The only thing we force is subscription billing: we strip ANTHROPIC_API_KEY (and
ANTHROPIC_AUTH_TOKEN) from the child's environment, because Claude Code prefers a
paid API key when one is present. With them removed it always falls back to the
logged-in subscription session — paid per-token billing is impossible.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess

from .config import MAX_SECONDS, Config
from .models import Brief, Pick
from .presenters import Presenter
from .prompts import build_prompt, build_tighten_prompt

# Auth vars that would route Claude Code to PAID, per-token API billing. We strip
# these so `claude -p` always falls back to your logged-in subscription session.
_PAID_AUTH_VARS = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")
_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)

# Replace Claude Code's default agentic system prompt with a pure transform
# instruction. Combined with `--tools ""` this stops the model from exploring
# the repo / replying conversationally — it just turns the prompt into JSON.
_SYSTEM_PROMPT = (
    "You are a strict JSON generator. The user's message fully specifies the task. "
    "Respond with ONLY the single raw JSON object it asks for — no prose, no "
    "explanation, no markdown code fence, no tool use. Begin your output with '{' "
    "and end with '}'."
)


class GenerationError(RuntimeError):
    pass


def _subscription_env() -> dict[str, str]:
    """Inherit the full env minus any paid-API auth, forcing subscription billing.

    `claude -p` then authenticates with your logged-in Claude Code session
    (~/.claude credentials), exactly as an interactive `claude` would.
    """
    env = dict(os.environ)
    for var in _PAID_AUTH_VARS:
        env.pop(var, None)
    return env


def _strip_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = _FENCE_RE.sub("", text)
    return text.strip()


def _run_claude(prompt: str, cfg: Config) -> str:
    """Invoke Claude headlessly; return the model's text output."""
    exe = shutil.which("claude")
    if not exe:
        raise GenerationError(
            "`claude` CLI not found on PATH. Install Claude Code and run `claude` "
            "once to log in with your Pro/Max subscription. See README.md."
        )

    # The prompt goes in via STDIN, never as a CLI argument: on Windows the
    # `claude` launcher is a shim and a multi-KB prompt containing newlines,
    # `<`, `>`, em-dashes or quotes gets mangled by command-line parsing
    # (the model then sees a fragment and asks for the missing stories).
    cmd = [
        exe,
        "-p",
        "--output-format",
        "json",
        "--system-prompt",
        _SYSTEM_PROMPT,
        "--tools",
        "",  # disable all built-in tools → no repo exploration, pure generation
    ]
    if cfg.claude_model:
        cmd += ["--model", cfg.claude_model]

    try:
        proc = subprocess.run(
            cmd,
            input=prompt,
            env=_subscription_env(),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=300,
        )
    except subprocess.TimeoutExpired as e:
        raise GenerationError("Claude generation timed out after 300s.") from e

    if proc.returncode != 0:
        raise GenerationError(
            f"claude exited {proc.returncode}: {proc.stderr.strip() or proc.stdout.strip()}"
        )

    # --output-format json wraps the answer: {"type":"result","result":"...",...}
    stdout = proc.stdout.strip()
    try:
        envelope = json.loads(stdout)
        text = envelope.get("result", stdout) if isinstance(envelope, dict) else stdout
    except json.JSONDecodeError:
        text = stdout  # tolerate a raw-text fallback

    if not text or not text.strip():
        raise GenerationError("Claude returned empty output.")
    return text


def _parse_brief(text: str) -> Brief:
    cleaned = _strip_fence(text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise GenerationError(f"Claude output was not valid JSON: {e}\n---\n{cleaned[:800]}") from e
    try:
        return Brief.model_validate(data)
    except Exception as e:  # pydantic ValidationError
        raise GenerationError(f"Claude JSON did not match the Brief schema: {e}") from e


def generate_brief(
    picks: list[Pick], presenter: Presenter | None, cfg: Config, n: int
) -> Brief:
    """Generate, and if over the 2-minute budget do ONE tightening pass, then accept."""
    prompt = build_prompt(picks, presenter, n)
    raw = _run_claude(prompt, cfg)
    brief = _parse_brief(raw)

    if brief.est_seconds > MAX_SECONDS:
        print(
            f"  ⚠ first draft is {brief.est_seconds:.0f}s (> {MAX_SECONDS}s) — "
            f"one tightening pass…"
        )
        tightened_raw = _run_claude(
            build_tighten_prompt(brief.model_dump_json(), brief.est_seconds), cfg
        )
        try:
            brief = _parse_brief(tightened_raw)
        except GenerationError as e:
            print(f"  ⚠ tightening pass failed to parse ({e}); keeping first draft.")
        if brief.est_seconds > MAX_SECONDS:
            print(
                f"  ⚠ still {brief.est_seconds:.0f}s after tightening — accepting with warning."
            )
    return brief
