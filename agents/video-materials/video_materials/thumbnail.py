"""Render the thumbnail: Jinja HTML+CSS → Playwright screenshot → PNG.

Full HTML+CSS (grid, gradients, web-safe fonts) screenshotted at 1080x1920
(VERTICAL 9:16, for TikTok/Reels/Shorts) by a headless Chromium. One-time setup:
`playwright install chromium` (see README).
"""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .config import TEMPLATES_DIR
from .models import Thumbnail
from .presenters import Presenter

WIDTH = 1080
HEIGHT = 1920  # vertical 9:16 (short-video format)

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml", "j2"]),
)


def render_html(thumb: Thumbnail, presenter: Presenter | None) -> str:
    template = _env.get_template("thumbnail.html.j2")
    return template.render(
        headline=thumb.headline,
        subtext=thumb.subtext,
        # Presenter is chosen later in the Record Video UI — omit it when neutral.
        presenter_name=presenter.name if presenter else None,
        presenter_handle=presenter.handle if presenter else None,
        accent="#0B57D0",
    )


def render_png(thumb: Thumbnail, presenter: Presenter | None, out_path: Path) -> Path:
    """Write the thumbnail PNG to out_path (also writes the .html beside it)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError(
            "playwright is not installed. `pip install -e .` then "
            "`playwright install chromium`. See README.md."
        ) from e

    html = render_html(thumb, presenter)
    html_path = out_path.with_suffix(".html")
    html_path.write_text(html, encoding="utf-8")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT})
            page.set_content(html, wait_until="networkidle")
            page.screenshot(path=str(out_path), clip={"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT})
        finally:
            browser.close()
    return out_path
