import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowed";

export const dynamic = "force-dynamic";

// GET /auth/callback?code=… — end of "Masuk dengan Google" (docs/DRIVE.md → "Login: Google only").
// Exchanges the PKCE code for a session, then rejects (signs out) any account that is not allow-listed.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const toLogin = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const desc = url.searchParams.get("error_description") ?? "";
    return toLogin(/tidak diizinkan|not allowed/i.test(desc) ? "not_allowed" : "auth_failed");
  }
  const code = url.searchParams.get("code");
  if (!code) return toLogin("no_code");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toLogin("auth_failed");

  let allowed = false;
  try {
    allowed = await isAllowed(supabase);
  } catch {
    allowed = false;
  }
  if (!allowed) {
    await supabase.auth.signOut();
    return toLogin("not_allowed");
  }
  // back to the page the person was opening (a shared task link), set by the login form
  const jar = req.headers.get("cookie") ?? "";
  const raw = /(?:^|;\s*)oc_next=([^;]*)/.exec(jar)?.[1];
  let next = raw ? decodeURIComponent(raw) : "";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/documents";
  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set("oc_next", "", { path: "/", maxAge: 0 });
  return res;
}
