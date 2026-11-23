// Allowlist check (docs/DRIVE.md → "Login: Google only"). The list lives in public.app_allowed_emails
// (service role only); public.is_allowed_user() answers for the JWT of the caller.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function isAllowed(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_allowed_user");
  if (error) throw new Error(`is_allowed_user: ${error.message}`);
  return data === true;
}

// For route handlers that use the service-role client (which bypasses RLS): signed in AND allow-listed,
// failing closed. Returns the user, or a JSON error response to return as is.
export async function requireAllowedUser(): Promise<{ user: User; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  try {
    if (!(await isAllowed(supabase))) return { error: NextResponse.json({ error: "Akun tidak diizinkan" }, { status: 403 }) };
  } catch (e) {
    return { error: NextResponse.json({ error: (e as Error).message }, { status: 503 }) };
  }
  return { user };
}
