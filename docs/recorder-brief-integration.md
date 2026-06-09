# Recorder ↔ Brief Integration (v1)

Spec for the **desktop recorder** (`github.com/opencraftdev/opencraft-recorder`) to consume a
news brief selected in the webapp. Brief-first recording: the user picks a brief in the webapp,
clicks **Record this brief**, the webapp deep-links the recorder with a `briefId` + short-lived
token, and the recorder fetches the full brief to drive its teleprompter.

This document describes only what the **recorder team** must implement. The webapp side
(mint-link route, brief-fetch route, token util) is already specified and owned by the webapp.

---

## 1. Deep link the recorder receives

The webapp launches the recorder via a custom protocol URL. Default scheme:

```
opencraft-recorder://record?briefId=<id>&presenter=<name>&handle=<handle>&t=<token>&api=<webapp-origin>
```

(The scheme/base is configurable on the webapp via `NEXT_PUBLIC_RECORDER_DEEP_LINK`, but the
**query parameters are fixed** — register the protocol handler and parse these five.)

| Param       | Meaning | Notes |
|-------------|---------|-------|
| `briefId`   | UUID of the brief in `public.news_briefs`. | Use verbatim in the fetch URL path. |
| `presenter` | Display name for the opening overlay (line 1). | **URL-encoded.** Decode before display. e.g. `Muhammad%20Rayandika`. |
| `handle`    | `@handle` for the opening overlay (line 2). | **URL-encoded.** e.g. `%40rayandikacode`. |
| `t`         | Short-lived opaque token authorizing the brief fetch. | **URL-encoded.** Decode, then pass back as `?t=`. See §3. |
| `api`       | The webapp origin the recorder should fetch the brief from. | **URL-encoded.** This is the exact origin the user opened the webapp on (e.g. the Tailscale HTTPS URL), so it is reachable from the recorder's machine. Use as `<WEBAPP_ORIGIN>` in §2. Overridable on the webapp via `NEXT_PUBLIC_SITE_URL`. |

The recorder should:
1. Register the OS protocol handler for the configured scheme (default `opencraft-recorder://`).
2. On launch (or while already running), parse the five params from the incoming URL.
3. URL-decode `presenter`, `handle`, `t`, and `api`.
4. Show `presenter` + `handle` on the opening overlay; fetch the brief (§2, using `api` as the origin) to drive the teleprompter.

### Concrete example URL

```
opencraft-recorder://record?briefId=8f3c1a2b-9d4e-4f10-bc77-2a1e6b0c5d99&presenter=Muhammad%20Rayandika&handle=%40rayandikacode&t=1733670000.YWJjZGVmZ2hpamtsbW5vcA&api=https%3A%2F%2Fdesktop-5dpjg9g.tailb63232.ts.net
```

---

## 2. Fetching the full brief

The deep link carries only the id + token — **not** the script. Fetch the full brief from the webapp:

```
GET  <WEBAPP_ORIGIN>/api/tutorial-video/brief/<briefId>?t=<token>
```

- `<WEBAPP_ORIGIN>` is the `api` deep-link param (the exact origin the user opened the webapp on).
  Decode it and use it verbatim — do not hardcode localhost. (If you ever receive a link without
  `api`, fall back to recorder config.)
- **Token-authed, not session-authed.** The recorder has no Supabase login. The route reads `?t=`
  and verifies it server-side; no cookies/headers are required.
- CORS is permissive (`Access-Control-Allow-Origin: *`) and `OPTIONS` preflight is handled, so a
  native/Electron client can call it directly. The route is token-gated, so this is safe.

### Response: `NewsBriefRow` JSON

`200 OK` returns the full brief row. Shape (from `src/features/news-materials/types.ts`):

```jsonc
{
  "id": "string (uuid)",
  "title": "string | null",
  "presenter_id": "string | null",   // brief may be presenter-neutral; prefer the deep-link presenter/handle
  "presenter_name": "string | null",
  "picks": [                          // source stories the brief was built from
    { "title": "string", "url": "string", "source": "string",
      "score": "number | null", "summary": "string | null" }
  ],
  "script": {                         // <-- drives the teleprompter (see §4)
    "hook": "string",
    "segments": [
      { "title": "string", "narration": "string", "seconds": "number" }
    ],
    "outro": "string",
    "total_words": "number",
    "est_seconds": "number"
  },
  "caption": { "text": "string", "hashtags": ["string"] },
  "thumbnail": { "headline": "string", "subtext": "string" },
  "thumbnail_url": "string | null",
  "est_seconds": "number | null",
  "source": "string | null",
  "created_at": "string (ISO timestamp)",
  "updated_at": "string (ISO timestamp)"
}
```

The recorder only strictly needs `script` (teleprompter) and may use `title` / `caption` /
`thumbnail` for display or post-record metadata. Treat any `null` / missing optional field defensively.

### fetch() pseudo-code

```js
async function loadBrief(webappOrigin, briefId, token) {
  const url = `${webappOrigin}/api/tutorial-video/brief/${briefId}?t=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "GET" });

  if (res.status === 401) {
    // Token expired or invalid — cannot self-renew. See §5.
    throw new TokenExpiredError("Recording link expired. Relaunch from the webapp.");
  }
  if (res.status === 404) {
    throw new BriefNotFoundError("Brief no longer exists.");
  }
  if (!res.ok) {
    throw new Error(`Brief fetch failed: HTTP ${res.status}`);
  }

  const brief = await res.json(); // NewsBriefRow
  return brief;
}
```

---

## 3. Token semantics

- **Short-lived** (~10 minutes from when the webapp minted the link). It exists only to authorize
  the one brief fetch.
- **Opaque to the recorder.** Do not parse, validate, modify, or persist it long-term. Just hold it
  in memory and **echo it back unchanged** as the `?t=` query param.
- It is bound to **this specific `briefId`** — it will not authorize a fetch for any other brief.
- One token = one short window. If recording starts well after the deep link arrived, the fetch may
  return `401` (§5).

---

## 4. Suggested teleprompter rendering

Build the teleprompter script from `script` in this order:

1. **Hook** — `script.hook` (the opening line that grabs attention).
2. **Body** — for each `segment` in `script.segments` (in array order):
   - `segment.narration` is a flowing spoken paragraph (not bullets) — render it as one block.
   - `segment.title` is an internal label; optionally show it small/dim as a section marker, but it
     is **not** spoken.
   - `segment.seconds` is the target spoken duration — use it to set/pace the auto-scroll speed for
     that block.
3. **Outro** — `script.outro` (the closing line / CTA).

Total runtime guidance: `script.est_seconds` (or top-level `est_seconds`). Target is a ≤2-minute read.

Minimal assembly:

```
[hook]
\n
[segments[0].narration]
[segments[1].narration]
...
\n
[outro]
```

---

## 5. Error handling

| Status | Meaning | Recorder behavior |
|--------|---------|-------------------|
| `401`  | Token expired or invalid. The recorder **cannot** renew it — there is no session. | Show a clear message: *"This recording link has expired. Go back to the webapp and click **Record this brief** again."* Do not retry the same token. |
| `404`  | Brief id not found (deleted, or wrong id). | Inform the user the brief is unavailable; offer to pick another from the webapp. |
| `5xx` / network | Transient server/network failure. | Safe to retry a few times with backoff (the token may still be valid within its window). |
| `200` with malformed body | Unexpected. | Fail gracefully; surface a generic error and log the payload. |

Because the token is short-lived and unrenewable, the canonical recovery for `401` is always:
**relaunch from the webapp** to mint a fresh link.
