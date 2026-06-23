"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SetVerifiedResult =
  | { ok: true; verified: boolean }
  | { ok: false; error: string };

/**
 * Mark a scraped lead as verified (or un-verify it) from the dashboard's
 * Scrapers view checklist button. This is a human sign-off layer on top of the
 * automated `validation_status` set by the `/validate` skill.
 *
 * Auth is checked with the cookie-bound client; the write uses the service-role
 * admin client (matching the app's other mutations), so it must stay server-only.
 */
export async function setLeadVerified(
  id: string,
  verified: boolean,
): Promise<SetVerifiedResult> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid lead id" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("scraper_leads")
    .update({
      verified,
      verified_at: verified ? now : null,
      updated_at: now,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/scrapers");
  return { ok: true, verified };
}
