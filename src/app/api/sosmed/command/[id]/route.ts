import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCommand } from "@/lib/sosmed/queries";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const command = await getCommand(supabase, numId, user.id);
    if (!command) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ command });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
