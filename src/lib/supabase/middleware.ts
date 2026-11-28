import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public pages (no login): the privacy policy is linked from the Google OAuth consent screen; /login and
// /auth/callback are the Google sign-in flow (docs/DRIVE.md → "Login: Google only").
// /api/ingest/* is called by agents (no browser session) and authenticates itself with a per-agent Bearer key.
const isPublicPath = (p: string) =>
  p === "/bd-preview" || p === "/privacy" || p === "/login" || p.startsWith("/login/") || p === "/auth/callback" || p.startsWith("/api/ingest/");

// Allowlist verdict per email, cached briefly per server instance so a page load does not cost an
// extra round trip per request. RLS (is_allowed_user()) is the real guard; this only signs blocked
// accounts out early with a clear message.
const ALLOW_TTL_MS = 60_000;
const allowCache = new Map<string, { ok: boolean; exp: number }>();

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // Redirect (or 401/403 for API calls), carrying over any auth cookies set/cleared above.
  const reject = (error: string | null, status: number) => {
    let res: NextResponse;
    if (isApi) {
      res = NextResponse.json({ error: error === "not_allowed" ? "Akun tidak diizinkan" : "Not authenticated" }, { status });
    } else {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = error ? `?error=${error}` : "";
      res = NextResponse.redirect(url);
    }
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user) {
    if (isPublicPath(path)) return supabaseResponse;
    return reject(null, 401);
  }

  if (path === "/auth/callback") return supabaseResponse;

  const email = (user.email ?? "").toLowerCase();
  const cached = allowCache.get(email);
  let allowed: boolean | null = cached && cached.exp > Date.now() ? cached.ok : null;
  if (allowed === null) {
    const { data, error } = await supabase.rpc("is_allowed_user");
    if (!error) {
      allowed = data === true;
      allowCache.set(email, { ok: allowed, exp: Date.now() + ALLOW_TTL_MS });
    }
    // On an RPC error, let the request through uncached: RLS still blocks data access.
  }

  if (allowed === false) {
    await supabase.auth.signOut();
    allowCache.delete(email);
    return reject("not_allowed", 403); // also on /login: the redirect carries the cleared session cookies
  }

  if (path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/documents";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
