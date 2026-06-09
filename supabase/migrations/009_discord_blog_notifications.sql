-- Discord "blog published" notifier.
--
-- Webhook URL is stored encrypted in Supabase Vault (name 'discord_blog_webhook')
-- via SECURITY DEFINER wrappers below. Non-secret config lives in
-- integration_settings (singleton). discord_notified_articles is the dedup
-- ledger — a slug present there has already been handled and never fires again.
--
-- NOTE: this mirrors the objects applied live via the Supabase MCP; kept here so
-- a fresh environment reproduces the same schema.

-- Vault-backed integration secrets (read/written only by the service role).
create or replace function public.set_integration_secret(p_name text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_secret, p_name, 'OpenCraft integration secret');
  else
    perform vault.update_secret(v_id, p_secret, p_name, 'OpenCraft integration secret');
  end if;
end;
$$;

create or replace function public.get_integration_secret(p_name text)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke all on function public.set_integration_secret(text, text) from public;
revoke all on function public.get_integration_secret(text) from public;
grant execute on function public.set_integration_secret(text, text) to service_role;
grant execute on function public.get_integration_secret(text) to service_role;

-- Singleton settings row. discord_sources null = notify for any source/platform.
create table if not exists public.integration_settings (
  id smallint primary key default 1,
  discord_enabled boolean not null default true,
  discord_sources text[],
  webhook_secret_name text not null default 'discord_blog_webhook',
  updated_at timestamptz not null default now(),
  constraint integration_settings_singleton check (id = 1)
);

insert into public.integration_settings (id) values (1)
on conflict (id) do nothing;

alter table public.integration_settings enable row level security;

-- Dedup ledger.
create table if not exists public.discord_notified_articles (
  slug text primary key,
  notified_at timestamptz not null default now()
);

alter table public.discord_notified_articles enable row level security;

-- No RLS policies on either table → only the service role (bypasses RLS) can
-- read/write them. All access is through server-side API routes.
