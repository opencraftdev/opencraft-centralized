import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPostsByMonth } from "@/lib/posts";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear());
  const month = Number(req.nextUrl.searchParams.get("month") ?? new Date().getMonth() + 1);

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year/month" }, { status: 400 });
  }

  const days = await getPostsByMonth(supabase, year, month);
  return NextResponse.json({ days });
}
