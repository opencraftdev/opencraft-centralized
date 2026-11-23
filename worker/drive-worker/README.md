# drive-worker

Background worker for `/documents` generation (contract: `docs/DRIVE.md`). Runs on the OpenCraft VPS,
not on Vercel; excluded from the Next.js type-check via `tsconfig.json` `exclude`.

Loop: every 5s `rpc('claim_drive_job')` → build prompt (first run: doc type + request + RESULT protocol;
follow-up: last user message + reminder with `session_id`) → `POST $GATEWAY_URL/v1/runs` (cc-gateway profile
`opencraft-document`, workdir `~/document-agent`) → parse the last `RESULT:` line →
`ready`: upload to bucket `drive` at `<id>/<basename>` and update the row · `needs_input`: store the question ·
anything else: `failed` + `error_msg`. One job at a time. 429 → re-queue after 30s. Rows stuck in
`generating` > 20 min are failed on startup and every 5 min; a job in flight when the worker is stopped is
marked `failed` ("please retry"). `cost_usd` is cumulative across a row's runs.

## Server layout

| what | where |
|---|---|
| code | `~/drive-worker/{worker.ts,package.json}` |
| env (chmod 600) | `~/drive-worker/.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GATEWAY_URL=http://127.0.0.1:8788`, `GATEWAY_KEY` (cc-gateway key `drive-worker`), `DOC_AGENT_DIR=/home/opencraft/document-agent` |
| service | `~/.config/systemd/user/drive-worker.service` (copy of `drive-worker.service`) |
| gateway | `cc-gateway@opencraft-document` (API-only, 127.0.0.1:8788) |

## Deploy / operate

```bash
rsync -a worker.ts package.json drive-worker.service opencraft:~/drive-worker/
ssh opencraft 'cd ~/drive-worker && ~/.local/bin/bun install --production \
  && cp drive-worker.service ~/.config/systemd/user/ && systemctl --user daemon-reload \
  && systemctl --user enable drive-worker && systemctl --user restart drive-worker'
ssh opencraft 'journalctl --user -u drive-worker -f'     # logs
```

Rotate the gateway key: `cc-gateway key revoke opencraft-document drive-worker`, then
`cc-gateway key create opencraft-document drive-worker` and update `GATEWAY_KEY` in `.env`.
