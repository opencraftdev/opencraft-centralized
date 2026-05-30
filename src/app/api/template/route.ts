import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeeklyTemplate, setWeeklyTemplate } from "@/lib/posts";
import { z } from "zod";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const template = await getWeeklyTemplate(supabase);
  return NextResponse.json({ template });
}

const TemplateSchema = z.object({
  template: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      contentType: z.enum(["engage", "educate", "video", "off"]),
    })
  ).length(7),
});

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = TemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const template = await setWeeklyTemplate(supabase, parsed.data.template);
  return NextResponse.json({ template });
}
