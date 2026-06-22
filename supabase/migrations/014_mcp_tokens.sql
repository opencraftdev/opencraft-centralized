-- Personal Access Tokens for the brand-knowledge MCP (and future internal MCPs).
-- A user generates a long-lived, revocable token in the app and pastes it into
-- their MCP client. Only the SHA-256 hash is stored; the raw token is shown once.

create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'MCP token',
  token_prefix text not null,                  -- first chars of the raw token, for display only
  token_hash   text not null unique,           -- sha256(raw token), hex
  scopes       text[] not null default '{}',   -- reserved (e.g. read / write) for later
  last_used_at timestamptz,
  expires_at   timestamptz,                     -- null = never expires
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id);
create index if not exists mcp_tokens_hash_idx on public.mcp_tokens (token_hash);

alter table public.mcp_tokens enable row level security;

-- Users manage only their own tokens. (Validation at the MCP endpoint uses the
-- service role, which bypasses RLS to look up a token by hash across all users.)
drop policy if exists "users read own mcp tokens" on public.mcp_tokens;
create policy "users read own mcp tokens" on public.mcp_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own mcp tokens" on public.mcp_tokens;
create policy "users insert own mcp tokens" on public.mcp_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own mcp tokens" on public.mcp_tokens;
create policy "users update own mcp tokens" on public.mcp_tokens
  for update using (auth.uid() = user_id);

drop policy if exists "users delete own mcp tokens" on public.mcp_tokens;
create policy "users delete own mcp tokens" on public.mcp_tokens
  for delete using (auth.uid() = user_id);
