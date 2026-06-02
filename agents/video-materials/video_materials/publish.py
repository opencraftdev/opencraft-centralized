"""Publish a brief to Supabase with the service-role key (bypasses RLS).

Same pattern the Document Agent / tutorial-video pipeline use: the external
agent owns a service-role key in its own .env and writes directly.

Order:
  1. insert the news_briefs row (no thumbnail_url yet) → get id
  2. upload <id>.png to the news-thumbnails bucket → public URL
  3. update the row's thumbnail_url
"""

from __future__ import annotations

from pathlib import Path

from supabase import Client, create_client

from .config import Config
from .models import Brief, Pick
from .presenters import Presenter


def _client(cfg: Config) -> Client:
    return create_client(cfg.supabase_url, cfg.supabase_service_role_key)


def publish_brief(
    cfg: Config,
    brief: Brief,
    picks: list[Pick],
    presenter: Presenter | None,
    thumbnail_png: Path,
) -> dict:
    """Write the brief; return the inserted row (with thumbnail_url). Raises on failure."""
    sb = _client(cfg)

    row = {
        "title": brief.title,
        # Presenter stays null — chosen later in the Record Video UI.
        "presenter_id": presenter.id if presenter else None,
        "presenter_name": presenter.name if presenter else None,
        "picks": [p.model_dump() for p in picks],
        "script": brief.script.model_dump(),
        "caption": brief.caption.model_dump(),
        "thumbnail": brief.thumbnail.model_dump(),
        "est_seconds": brief.est_seconds,
        "source": "video-materials",
    }

    # 1. insert → id
    inserted = sb.table(cfg.table).insert(row).execute()
    if not inserted.data:
        raise RuntimeError("Insert into news_briefs returned no row.")
    brief_id = inserted.data[0]["id"]

    # 2. upload thumbnail → public URL
    thumbnail_url: str | None = None
    if thumbnail_png.exists():
        object_path = f"{brief_id}.png"
        data = thumbnail_png.read_bytes()
        sb.storage.from_(cfg.thumbnail_bucket).upload(
            object_path,
            data,
            {"content-type": "image/png", "upsert": "true"},
        )
        thumbnail_url = sb.storage.from_(cfg.thumbnail_bucket).get_public_url(object_path)

        # 3. update row with the URL
        sb.table(cfg.table).update({"thumbnail_url": thumbnail_url}).eq("id", brief_id).execute()

    return {**inserted.data[0], "thumbnail_url": thumbnail_url}
