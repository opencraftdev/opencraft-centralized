import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeeklyTemplate, createPost, getPostsByMonth } from "@/lib/posts";
import { getDaysInMonth, getDay, format } from "date-fns";
import type { PostType } from "@/lib/types";
import { z } from "zod";

const Schema = z.object({
  year: z.number().int().min(2024).max(2030),
  month: z.number().int().min(1).max(12),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { year, month } = parsed.data;
  const template = await getWeeklyTemplate(supabase);
  const existing = await getPostsByMonth(supabase, year, month);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  const created: string[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    if (date < today) continue;

    const dateStr = format(date, "yyyy-MM-dd");
    if (existing[dateStr]?.length) continue;

    const dayOfWeek = getDay(date);
    const entry = template.find((t) => t.dayOfWeek === dayOfWeek);
    if (!entry || entry.contentType === "off") continue;

    await createPost(supabase, { type: entry.contentType as PostType, dateSlot: dateStr });
    created.push(dateStr);
  }

  return NextResponse.json({ created: created.length, dates: created });
}
