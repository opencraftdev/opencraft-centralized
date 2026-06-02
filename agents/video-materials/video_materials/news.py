"""ai-news-mcp client — deterministic, free, no Claude involved.

Stateless HTTP MCP (verified 2026-05-31: no auth, no session, CORS open,
JSON-RPC 2.0). We POST a tools/call for `get_top_picks`. The payload is
DOUBLE-ENCODED: result.content[0].text is itself a JSON string that decodes to
{ total, cached_at, picks:[{title,url,source,score,summary}] }.
"""

from __future__ import annotations

import json

import httpx

from .models import Pick


def get_top_picks(mcp_url: str, n: int = 5, timeout: float = 30.0) -> list[Pick]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "get_top_picks", "arguments": {"n": n}},
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(mcp_url, json=payload, headers=headers)
        resp.raise_for_status()
        envelope = resp.json()

    if "error" in envelope:
        raise RuntimeError(f"ai-news-mcp error: {envelope['error']}")

    try:
        content = envelope["result"]["content"]
        text = content[0]["text"]  # inner JSON string (double-encoded)
        inner = json.loads(text)
        raw_picks = inner["picks"]
    except (KeyError, IndexError, json.JSONDecodeError, TypeError) as e:
        raise RuntimeError(f"Unexpected ai-news-mcp response shape: {e}") from e

    picks = [Pick.model_validate(p) for p in raw_picks[:n]]
    if not picks:
        raise RuntimeError("ai-news-mcp returned zero picks.")
    return picks
