import { createAdminClient } from "@/lib/supabase/admin";

// Thin wrappers over the Supabase Vault RPCs (public.set/get_integration_secret,
// SECURITY DEFINER, service-role only). Secrets are encrypted at rest in the
// vault; only the service role can read or write them. Server-only.

export async function setSecret(name: string, secret: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_integration_secret", { p_name: name, p_secret: secret });
  if (error) throw error;
}

export async function getSecret(name: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_integration_secret", { p_name: name });
  if (error) throw error;
  const value = (data as string | null) ?? null;
  return value && value.length > 0 ? value : null;
}
