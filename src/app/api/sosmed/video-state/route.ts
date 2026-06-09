import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVideoAgentState } from "@/lib/sosmed/queries";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const items = await getVideoAgentState(supabase, user.id);
    return NextResponse.json({ items: items ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
