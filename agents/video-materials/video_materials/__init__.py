"""video-materials — local AI News Brief runner.

Fetches top AI-news picks (ai-news-mcp, deterministic httpx), generates a
<=2-minute video brief (script + caption + thumbnail copy) via the Claude Code
subscription (no Anthropic API key), renders a 1280x720 thumbnail PNG, and
publishes the result to Supabase (row + Storage) with the service-role key.

The dashboard (opencraft-centralized) only reads what this agent writes.
"""

__version__ = "0.1.0"
