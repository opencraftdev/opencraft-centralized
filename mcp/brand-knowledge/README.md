# Brand Knowledge MCP

An [MCP](https://modelcontextprotocol.io) server that exposes the **brand knowledge graph**
(Supabase tables `brand_knowledge_nodes` + `brand_knowledge_edges`) so internal agents can
read and curate everything about a brand.

## Tools

| Tool | Purpose |
|------|---------|
| `get_graph` | Full graph (nodes + edges) for a brand, with counts by type. |
| `search_nodes` | Find nodes by text in label/description, optional type filter. |
| `get_node` | One node by id **or** exact label + its incoming/outgoing edges and neighbours. |
| `list_types` | Distinct node types and their counts. |
| `upsert_node` | Create or update a node (curate the graph). |
| `add_edge` | Relate two nodes (endpoints accept id **or** label). |
| `delete_node` | Delete a node (edges cascade). |

`brand_slug` defaults to `opencraft` (override per call or via `BRAND_KNOWLEDGE_DEFAULT_BRAND`).

## Environment

The server connects with the Supabase **service-role** key (full read/write):

```
SUPABASE_URL=...                  # or NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=...
BRAND_KNOWLEDGE_DEFAULT_BRAND=opencraft   # optional
```

These already live in the app's `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`).

## Install

```bash
cd mcp/brand-knowledge && bun install
```

## Two ways to run it

| Mode | Where | Who | Auth |
|------|-------|-----|------|
| **Hosted HTTP** (recommended for the team) | `/api/mcp` route in the Next.js app, deployed to internal.ocraft | all internal users, via URL | each user's Supabase login (Bearer JWT) |
| **Local stdio** | `mcp/brand-knowledge/src/index.ts` | this machine only | service-role key from `.env.local` |

---

## Hosted HTTP — install for all internal users

The app exposes the same graph as an authenticated MCP endpoint at **`/api/mcp`**
(`src/app/api/mcp/route.ts`). It deploys with the app — nothing to host separately.
The service-role key never leaves the server; every call must carry a valid
**Supabase access token** (the user's own login), reads honour RLS, writes go
through a controlled path.

### Install (recommended): Personal Access Token

1. Log into the app → **Settings → Brand Knowledge MCP → Generate token**.
2. Copy the token (`ocb_live_…`, shown once) — the page gives you the full command:

```bash
claude mcp add --transport http brand-knowledge \
  https://internal.ocraft.id/api/mcp \
  --header "Authorization: Bearer ocb_live_xxxxxxxxxxxx"
```

PATs are durable (never expire unless you set an expiry), revocable from the same
page, and per-user. Backed by the `mcp_tokens` table (only a SHA-256 hash is stored).

The endpoint also accepts a raw **Supabase access token** as the bearer (handy for
quick tests), but those expire ~hourly — prefer a PAT for daily use.

Server env (already set in the app's deploy / `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MCP_URL=https://internal.ocraft.id/api/mcp   # shown in the Settings install command
BRAND_KNOWLEDGE_DEFAULT_BRAND=opencraft                  # optional
```

---

## Local stdio — register with Claude Code

From the repo root (substitute the real values, or export them first):

```bash
claude mcp add brand-knowledge \
  --env SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --env SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -- bun run /home/muhammad/repo-wsl/opencraft-centralized/mcp/brand-knowledge/src/index.ts
```

Or add it to `.mcp.json` / your client config:

```json
{
  "mcpServers": {
    "brand-knowledge": {
      "command": "bun",
      "args": ["run", "mcp/brand-knowledge/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://YOUR-PROJECT.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "service-role-key"
      }
    }
  }
}
```

> The service-role key bypasses RLS. Run this server only in trusted, internal contexts.

## Smoke test

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  bun run src/index.ts   # then speak MCP JSON-RPC over stdin
```
