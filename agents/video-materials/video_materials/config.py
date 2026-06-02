"""Environment + tunable constants for the runner.

Loads the agent's own .env (never committed). The Supabase values are the SAME
project the dashboard uses — just named without the NEXT_PUBLIC_ prefix since
this is a server-side tool (see ../README.md and admin.ts in the web app).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# agents/video-materials/
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "out"
TEMPLATES_DIR = ROOT / "templates"

# Load .env from the agent root (no-op if already set in the environment).
load_dotenv(ROOT / ".env")

# ── 2-minute budget (see README + docs/AI-NEWS-BRIEF.md) ──────────────────
WORDS_PER_MINUTE = 140
MAX_SECONDS = 120
WORD_BUDGET = WORDS_PER_MINUTE * (MAX_SECONDS / 60)  # ≈ 280 words
DEFAULT_N = 5  # ~20s/item over ~225w of body → 5 picks


@dataclass(frozen=True)
class Config:
    supabase_url: str
    supabase_service_role_key: str
    thumbnail_bucket: str
    ai_news_mcp_url: str
    claude_model: str | None

    @property
    def table(self) -> str:
        return "news_briefs"


def _require(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        raise SystemExit(
            f"Missing required env var {name}. Copy .env.example to .env and fill it in "
            f"(see README.md)."
        )
    return val


def load_config() -> Config:
    return Config(
        supabase_url=_require("SUPABASE_URL"),
        supabase_service_role_key=_require("SUPABASE_SERVICE_ROLE_KEY"),
        thumbnail_bucket=os.environ.get("SUPABASE_THUMBNAIL_BUCKET", "news-thumbnails").strip(),
        ai_news_mcp_url=os.environ.get(
            "AI_NEWS_MCP_URL",
            "https://iiwkkrvyhktnwolsfndx.supabase.co/functions/v1/mcp",
        ).strip(),
        # No Claude token: generate.py uses your logged-in `claude` session and
        # strips ANTHROPIC_API_KEY so it can never fall back to paid billing.
        claude_model=os.environ.get("CLAUDE_MODEL", "").strip() or None,
    )
