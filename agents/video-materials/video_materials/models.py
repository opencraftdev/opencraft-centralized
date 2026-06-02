"""Pydantic models — the shape of everything that flows through the runner.

These mirror the JSONB columns in public.news_briefs (see
supabase/migrations/005_news_briefs.sql) so what we validate here is exactly
what the web app reads back (src/features/news-materials/types.ts).
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class Pick(BaseModel):
    """One source story from ai-news-mcp."""

    title: str
    url: str
    source: str
    score: float | None = None
    summary: str | None = None


class Segment(BaseModel):
    """One spoken segment of the script — a flowing paragraph, not bullet points."""

    title: str
    narration: str
    seconds: float

    @field_validator("seconds")
    @classmethod
    def _non_negative(cls, v: float) -> float:
        return max(0.0, float(v))


class Script(BaseModel):
    hook: str
    segments: list[Segment]
    outro: str
    total_words: int
    est_seconds: float


class Caption(BaseModel):
    text: str
    hashtags: list[str] = Field(default_factory=list)


class Thumbnail(BaseModel):
    headline: str
    subtext: str


class Brief(BaseModel):
    """The full generated brief — what generate.py returns and publish.py writes."""

    title: str
    script: Script
    caption: Caption
    thumbnail: Thumbnail

    @property
    def est_seconds(self) -> float:
        return self.script.est_seconds
