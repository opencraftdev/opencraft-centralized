import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GenerationJobRow } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const jobId = Number(req.nextUrl.searchParams.get("jobId"));
  if (!jobId) return new Response("missing jobId", { status: 400 });

  let lastLogLen = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };

      const poll = async () => {
        if (closed) return;

        const { data: row } = await supabase
          .from("generation_jobs")
          .select()
          .eq("id", jobId)
          .single();

        if (!row) {
          send({ error: "Job not found", done: true });
          controller.close();
          return;
        }

        const typedRow = row as GenerationJobRow;
        const log = typedRow.log_text ?? "";
        if (log.length > lastLogLen) {
          const chunk = log.slice(lastLogLen);
          lastLogLen = log.length;
          const lines = chunk.split("\n").filter(Boolean);
          for (const line of lines) {
            send({ logLine: line, step: typedRow.current_step, progressPct: typedRow.progress_pct });
          }
        }

        if (typedRow.status === "completed") {
          send({ done: true, step: "Done", progressPct: 100 });
          controller.close();
          return;
        }
        if (typedRow.status === "failed") {
          send({ done: true, error: typedRow.error_msg ?? "Unknown error" });
          controller.close();
          return;
        }

        setTimeout(poll, 500);
      };

      await poll();
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
