import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { updatePost, appendJobLog } from "./posts";

const REPO_ROOT = process.env.REPO_ROOT ?? resolve(process.cwd(), "..");

// Uses service role key to bypass RLS — this runs as a background task
// without request cookies, so the anon key + RLS would block all writes.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function runVideoPipeline(
  jobId: number,
  postId: number,
  videoId: string,
  videoTitle: string,
  _videoUrl: string,
): Promise<void> {
  const supabase = getServiceClient();

  await supabase
    .from("generation_jobs")
    .update({ status: "running", video_id: videoId, started_at: new Date().toISOString() })
    .eq("id", jobId);

  await appendJobLog(supabase, jobId, `[start] video ${videoId} — ${videoTitle}`, { step: "Starting", progressPct: 5 });

  try {
    const tsxBin = resolve(REPO_ROOT, "node_modules/.bin/tsx");
    const draftScript = resolve(REPO_ROOT, "src/cli/agentDraft.ts");

    await new Promise<void>((res, rej) => {
      const child = spawn(tsxBin, [draftScript, `--video-id=${videoId}`], {
        cwd: REPO_ROOT,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      child.stdout.on("data", (buf: Buffer) => {
        const lines = buf.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          let step: string | undefined;
          let pct: number | undefined;
          if (line.includes("[time] download") || line.includes("downloading"))   { step = "Downloading video";     pct = 20; }
          else if (line.includes("[transcript]"))                                   { step = "Processing transcript"; pct = 40; }
          else if (line.includes("[summary]"))                                      { step = "Summarizing";           pct = 55; }
          else if (line.includes("[clip]"))                                         { step = "Extracting clip";       pct = 65; }
          else if (line.includes("[headline]"))                                     { step = "Writing headline";      pct = 75; }
          else if (line.includes("[captions]"))                                     { step = "Writing captions";      pct = 85; }
          else if (line.includes("[time] render") || line.includes("Rendering"))   { step = "Rendering video";       pct = 90; }
          void appendJobLog(supabase, jobId, line, { step, progressPct: pct });
        }
      });

      child.stderr.on("data", (buf: Buffer) => {
        buf.toString().split("\n").filter(Boolean).forEach((l) => {
          void appendJobLog(supabase, jobId, `[err] ${l}`);
        });
      });

      child.on("close", (code) => {
        if (code === 0) res();
        else rej(new Error(`agentDraft exited with code ${code}`));
      });
    });

    await appendJobLog(supabase, jobId, "[post] reading state…", { step: "Finalizing", progressPct: 95 });

    try {
      const { readFileSync, existsSync } = await import("node:fs");
      const statePath = resolve(REPO_ROOT, ".agent-state.json");
      if (!existsSync(statePath)) throw new Error(`.agent-state.json not found`);
      const state = JSON.parse(readFileSync(statePath, "utf-8")) as {
        phase?: string;
        bundle?: { renderedPath?: string; headline?: string; captions?: Record<string, string>; hashtags?: Record<string, string[]> };
        source?: { url?: string; channelTitle?: string; videoId?: string; videoTitle?: string };
      };

      if (state.phase === "drafted" && state.bundle?.renderedPath) {
        await updatePost(supabase, postId, {
          videoPath: state.bundle.renderedPath,
          headline: state.bundle.headline,
          captions: state.bundle.captions as Record<string, string> | null,
          hashtags: state.bundle.hashtags as Record<string, string[]> | null,
          source: state.source
            ? { videoUrl: state.source.url ?? "", channelTitle: state.source.channelTitle ?? "", videoId: state.source.videoId ?? "", videoTitle: state.source.videoTitle ?? "" }
            : null,
          status: "draft",
        });
        await appendJobLog(supabase, jobId, `[done] MP4 ready: ${state.bundle.renderedPath}`, { step: "Done", progressPct: 100, status: "completed" });
      } else {
        await appendJobLog(supabase, jobId, `[warn] unexpected state phase: ${state.phase}`, { step: "Done", progressPct: 100, status: "completed" });
      }
    } catch (stateErr) {
      await appendJobLog(supabase, jobId, `[warn] could not read state: ${stateErr}`, { step: "Done", progressPct: 100, status: "completed" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await appendJobLog(supabase, jobId, `[error] ${msg}`, { step: "Failed", status: "failed" });
    await supabase
      .from("generation_jobs")
      .update({ error_msg: msg.slice(0, 500), completed_at: new Date().toISOString() })
      .eq("id", jobId);
    throw err;
  }

  await supabase
    .from("generation_jobs")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", jobId);
}
