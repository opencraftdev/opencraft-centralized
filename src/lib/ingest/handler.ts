import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateAgent } from "@/lib/ingest/auth";
import type { AgentRow } from "@/lib/monitor/types";

// Boilerplate shared by every /api/ingest/* route:
//   1. parse JSON body
//   2. validate it with the route's Zod schema (400 on failure)
//   3. authenticate the per-agent API key against body.slug (401 on failure)
// On success, hands the route the validated payload, the resolved agent row,
// and a service-role client to write with.

export type IngestContext<T> = {
  data: T;
  agent: AgentRow;
  admin: SupabaseClient;
};

export async function withIngest<T extends { slug: string }>(
  req: Request,
  schema: ZodType<T>,
  run: (ctx: IngestContext<T>) => Promise<NextResponse>,
): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const auth = await authenticateAgent(admin, req, parsed.data.slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    return await run({ data: parsed.data, agent: auth.agent, admin });
  } catch (err) {
    console.error("ingest handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
