#!/usr/bin/env python3
"""video-materials — AI News Brief runner (entrypoint).

    python run.py --presenter rayandika --n 5

Pipeline:
    fetch picks (ai-news-mcp) → generate (claude, scrubbed env) → render PNG
    → publish to Supabase → save local out/<date>-<slug>/ copies.

On publish failure the local files are kept and we exit non-zero with a clear
message, so nothing the agent did is lost.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

# Windows consoles default to cp1252, which can't encode the status glyphs
# (▶ • ✖ ✓ →). Force UTF-8 so output never crashes on encoding.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

from video_materials.config import DEFAULT_N, OUT_DIR, load_config
from video_materials.generate import GenerationError, generate_brief
from video_materials.news import get_top_picks
from video_materials.presenters import PRESENTERS, get_presenter
from video_materials.publish import publish_brief
from video_materials.thumbnail import render_png


def _slug(text: str, max_len: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (s[:max_len].rstrip("-")) or "brief"


def _save_local(out_dir: Path, brief, picks, caption_text: str) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "brief.json").write_text(
        json.dumps(
            {
                "title": brief.title,
                "picks": [p.model_dump() for p in picks],
                "script": brief.script.model_dump(),
                "caption": brief.caption.model_dump(),
                "thumbnail": brief.thumbnail.model_dump(),
                "est_seconds": brief.est_seconds,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    # script.md
    s = brief.script
    lines = [f"# {brief.title}", "", f"_{s.total_words} words · ~{s.est_seconds:.0f}s_", "", s.hook, ""]
    for seg in s.segments:
        lines.append(f"## {seg.title}  ({seg.seconds:.0f}s)")
        lines += [seg.narration, ""]
    lines += [s.outro, ""]
    (out_dir / "script.md").write_text("\n".join(lines), encoding="utf-8")
    (out_dir / "caption.txt").write_text(caption_text, encoding="utf-8")


def _caption_text(brief) -> str:
    tags = " ".join(h if h.startswith("#") else f"#{h}" for h in brief.caption.hashtags)
    return f"{brief.caption.text}\n\n{tags}".strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate & publish an AI News Brief.")
    parser.add_argument(
        "--presenter",
        default=None,
        choices=[p.id for p in PRESENTERS],
        help="optional presenter id; default is presenter-neutral (picked later in "
        "the Record Video UI)",
    )
    parser.add_argument("--n", type=int, default=DEFAULT_N, help=f"number of picks (default: {DEFAULT_N})")
    parser.add_argument("--dry-run", action="store_true", help="generate + render locally, skip Supabase publish")
    args = parser.parse_args()

    try:
        cfg = load_config()
    except SystemExit as e:
        print(str(e), file=sys.stderr)
        return 2

    presenter = get_presenter(args.presenter) if args.presenter else None
    who = presenter.name if presenter else "neutral (dipilih di UI Record Video)"
    print(f"▶ AI News Brief — presenter={who}  n={args.n}")

    # 1. fetch
    print("• fetching top picks from ai-news-mcp…")
    try:
        picks = get_top_picks(cfg.ai_news_mcp_url, args.n)
    except Exception as e:
        print(f"✖ fetch failed: {e}", file=sys.stderr)
        return 1
    print(f"  got {len(picks)} picks: " + "; ".join(p.title for p in picks))

    # 2. generate
    print("• generating brief via Claude (subscription, scrubbed env)…")
    try:
        brief = generate_brief(picks, presenter, cfg, args.n)
    except GenerationError as e:
        print(f"✖ generation failed: {e}", file=sys.stderr)
        return 1
    print(f"  '{brief.title}' — {brief.script.total_words} words, ~{brief.est_seconds:.0f}s")

    # local copies (always, before publish)
    out_dir = OUT_DIR / f"{date.today().isoformat()}-{_slug(brief.title)}"
    caption_text = _caption_text(brief)
    _save_local(out_dir, brief, picks, caption_text)

    # 3. render thumbnail
    print("• rendering thumbnail (Playwright)…")
    png_path = out_dir / "thumbnail.png"
    try:
        render_png(brief.thumbnail, presenter, png_path)
    except Exception as e:
        print(f"✖ thumbnail render failed: {e}", file=sys.stderr)
        print(f"  local files kept in {out_dir}", file=sys.stderr)
        return 1
    print(f"  → {png_path}")

    if args.dry_run:
        print(f"✓ dry run complete — local files in {out_dir} (Supabase publish skipped).")
        return 0

    # 4. publish
    print("• publishing to Supabase (service-role)…")
    try:
        result = publish_brief(cfg, brief, picks, presenter, png_path)
    except Exception as e:
        print(f"✖ publish failed: {e}", file=sys.stderr)
        print(f"  local files kept in {out_dir} — fix env/connection and re-run.", file=sys.stderr)
        return 1

    print(f"✓ published brief {result['id']}")
    if result.get("thumbnail_url"):
        print(f"  thumbnail: {result['thumbnail_url']}")
    print(f"  local copies: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
