// Chat loop (contract: docs/CHAT.md): claims queued `chats` (rpc claim_chat_run), sends the not-yet-consumed user
// messages to the cc-gateway "opencraft-chat" profile (resuming the chat's session), streams steps/text into the
// chat row, stores the answer as a chat_messages row and uploads files the agent ATTACHes to Google Drive
// (drive_files source='chat'). Also mirrors enabled `skills` into <CHAT_WORKDIR>/.claude/skills/<name>/SKILL.md.
// Runs as a second loop inside the drive-worker process; one chat run at a time.
import type { SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  MIME, RetryLater, callGateway, deleteRun, liveWriter, nextCost, now, progressFor, sleep, visibleText,
  type Gateway, type Hooks, type Init, type Req, type RunResp,
} from "./gateway.ts";

type Drive = {
  uploadFile: (a: { folderId: string | null; name: string; mimeType: string; bytes: Uint8Array }) =>
    Promise<{ id: string; size: number; modifiedTime: string | null }>;
  deleteFile: (id: string) => Promise<void>;
};
type Chat = {
  id: string;
  session_id: string | null;
  consumed_at: string | null;
  cancel_requested_at: string | null;
  cost_usd: number | string | null;
  created_by: string | null;
};
type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type Attach = { path: string; folder?: string; doc_number?: string };
type Attachment = { file_id: string; name: string; mime_type: string };

const MARKERS = ["ATTACH:", "RESULT:"];
const FILE_ROOT = "/home/opencraft";
const MAX_ATTACH_BYTES = 100 * 1024 * 1024;
const CANCEL_POLL_MS = 2000;
const SKILLS_SYNC_MS = 30_000;
const STALE_MINUTES = 20;
const REPLAY_MESSAGES = 20;
const MARKER_FILE = ".managed-by-dashboard";
const DOC_TYPE: Record<string, string> = { sph: "sph", mou: "mou", deck: "deck" };
// Columns nulled in the same update that ends a run.
const LIVE_CLEAR = { run_steps: null, stream_text: null, started_at: null, cancel_requested_at: null };

export function createChatLoop(opts: {
  db: SupabaseClient;
  gdrive: Drive;
  gateway: Gateway;
  workdir: string;
  pollMs: number;
  log: (...a: unknown[]) => void;
}) {
  const { db, gdrive, gateway: gw, workdir, log } = opts;
  const skillsDir = path.join(workdir, ".claude", "skills");
  let stopping = false;
  let current: { id: string; steps: () => unknown[]; t0: number } | null = null;

  // ---------- skills sync ----------
  let skillsSig = "";
  async function syncSkills(): Promise<void> {
    const { data, error } = await db.from("skills").select("name, description, body, enabled, updated_at").order("name");
    if (error) throw new Error(`skills: ${error.message}`);
    const rows = (data ?? []) as { name: string; description: string; body: string; enabled: boolean; updated_at: string }[];
    const enabled = rows.filter((r) => r.enabled && /^[a-z0-9][a-z0-9-]{0,62}$/.test(r.name));
    const sig = JSON.stringify(enabled.map((r) => [r.name, r.updated_at]));
    const missing = enabled.some((r) => !fs.existsSync(path.join(skillsDir, r.name, MARKER_FILE)));
    if (sig === skillsSig && !missing) return;
    fs.mkdirSync(skillsDir, { recursive: true });
    const want = new Set(enabled.map((r) => r.name));
    let written = 0;
    let removed = 0;
    for (const r of enabled) {
      const dir = path.join(skillsDir, r.name);
      if (fs.existsSync(dir) && !fs.existsSync(path.join(dir, MARKER_FILE))) {
        log(`skills: ${dir} exists and is not managed by the dashboard; left alone`);
        continue;
      }
      fs.mkdirSync(dir, { recursive: true });
      // JSON string = valid YAML double-quoted scalar (a description may contain ':' or '#').
      const md = `---\nname: ${r.name}\ndescription: ${JSON.stringify(r.description.replace(/\s+/g, " ").trim())}\n---\n\n${r.body.trim()}\n`;
      const file = path.join(dir, "SKILL.md");
      const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      if (cur !== md) {
        fs.writeFileSync(`${file}.tmp`, md);
        fs.renameSync(`${file}.tmp`, file);
        written++;
      }
      fs.writeFileSync(path.join(dir, MARKER_FILE), `updated_at=${r.updated_at}\n`);
    }
    for (const name of fs.readdirSync(skillsDir)) {
      const dir = path.join(skillsDir, name);
      if (want.has(name) || !fs.existsSync(path.join(dir, MARKER_FILE))) continue;
      fs.rmSync(dir, { recursive: true, force: true });
      removed++;
    }
    skillsSig = sig;
    if (written || removed) log(`skills sync: ${enabled.length} enabled, wrote ${written}, removed ${removed}`);
  }

  // ---------- prompt ----------
  async function enabledSkillNames(): Promise<Set<string>> {
    const { data } = await db.from("skills").select("name").eq("enabled", true);
    return new Set((data ?? []).map((r) => r.name as string));
  }

  // A leading "/name" of an enabled skill → explicit instruction to use that skill.
  function rewriteSkill(text: string, skills: Set<string>): string {
    const m = /^\/([a-z0-9][a-z0-9-]{0,62})(?=\s|$)\s*/.exec(text);
    if (!m || !skills.has(m[1])) return text;
    return `Use the skill "${m[1]}" (Skill tool) for this request.\n\n${text.slice(m[0].length)}`.trim();
  }

  async function transcript(chatId: string, before: string | null): Promise<string> {
    if (!before) return "";
    const { data } = await db
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("chat_id", chatId)
      .lte("created_at", before)
      .order("created_at", { ascending: false })
      .limit(REPLAY_MESSAGES);
    const rows = ((data ?? []) as Message[]).reverse().filter((m) => m.content.trim());
    if (!rows.length) return "";
    return (
      "(The previous session of this chat is no longer available. Conversation so far, for context:)\n\n" +
      rows.map((m) => `${m.role === "user" ? "User" : "Asisten"}: ${m.content}`).join("\n\n") +
      "\n\n(New message from the user:)\n\n"
    );
  }

  // ---------- attachments ----------
  function parseAttach(text: string): Attach[] {
    const out: Attach[] = [];
    for (const line of text.split(/\r?\n/)) {
      const i = line.indexOf("ATTACH:");
      if (i < 0) continue;
      const raw = line.slice(i + 7).trim().replace(/^`+|`+$/g, "").trim();
      try {
        const a = JSON.parse(raw);
        if (a && typeof a.path === "string" && !out.some((x) => x.path === a.path))
          out.push({
            path: a.path,
            folder: typeof a.folder === "string" && a.folder.trim() ? a.folder.trim() : undefined,
            doc_number: typeof a.doc_number === "string" && a.doc_number.trim() ? a.doc_number.trim() : undefined,
          });
      } catch {
        log(`chat: unparsable ATTACH line: ${raw.slice(0, 200)}`);
      }
    }
    return out;
  }

  function safeFile(p: string): string {
    if (!path.isAbsolute(p)) throw new Error("path harus absolut");
    const abs = fs.realpathSync(p);
    if (!abs.startsWith(FILE_ROOT + path.sep)) throw new Error(`hanya file di bawah ${FILE_ROOT}/ yang bisa dilampirkan`);
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new Error("bukan file");
    if (st.size > MAX_ATTACH_BYTES) throw new Error("file terlalu besar (> 100 MB)");
    return abs;
  }

  // Dashboard folder `name` directly under the root: an existing non-trashed row, else a new row (its Google folder
  // is created lazily by uploadFile → ensureFolder, like the web app's folders).
  async function folderByName(name: string, createdBy: string | null): Promise<string> {
    const find = async () => {
      const { data, error } = await db
        .from("drive_folders")
        .select("id, name")
        .is("parent_id", null)
        .is("trashed_at", null)
        .ilike("name", name.replace(/[\\%_]/g, (c) => `\\${c}`))
        .order("created_at");
      if (error) throw new Error(`drive_folders: ${error.message}`);
      const rows = (data ?? []) as { id: string; name: string }[];
      return (rows.find((r) => r.name === name) ?? rows[0])?.id ?? null;
    };
    const found = await find();
    if (found) return found;
    const { data, error } = await db
      .from("drive_folders")
      .insert({ name, parent_id: null, created_by: createdBy })
      .select("id")
      .single();
    if (error) throw new Error(`create folder ${name}: ${error.message}`);
    log(`chat: created dashboard folder "${name}" ${data.id}`);
    return data.id as string;
  }

  async function attachOne(chat: Chat, a: Attach): Promise<Attachment> {
    const abs = safeFile(a.path);
    const name = path.basename(abs);
    const mime = MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
    const folderName = a.folder ?? "Chat";
    const folderId = await folderByName(folderName, chat.created_by);
    const docType = DOC_TYPE[folderName.toLowerCase()] ?? null;
    const bytes = fs.readFileSync(abs);
    const { data: existing } = await db
      .from("drive_files")
      .select("id, google_file_id, doc_number")
      .eq("chat_id", chat.id)
      .eq("chat_path", abs)
      .is("trashed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const up = await gdrive.uploadFile({ folderId, name, mimeType: mime, bytes });
    const fields = {
      name,
      folder_id: folderId,
      mime_type: mime,
      size_bytes: up.size,
      google_file_id: up.id,
      google_modified_at: up.modifiedTime,
      doc_type: docType,
      status: "ready",
      updated_at: now(),
    };
    let fileId: string;
    try {
      // The sync loop may already have mirrored the fresh Google file as its own row: drop that duplicate.
      await db.from("drive_files").delete().eq("google_file_id", up.id).eq("source", "google");
      if (existing) {
        const { error } = await db
          .from("drive_files")
          .update({ ...fields, doc_number: a.doc_number ?? existing.doc_number ?? null })
          .eq("id", existing.id);
        if (error) throw new Error(`drive_files update: ${error.message}`);
        fileId = existing.id as string;
      } else {
        const { data, error } = await db
          .from("drive_files")
          .insert({ ...fields, source: "chat", chat_id: chat.id, chat_path: abs, doc_number: a.doc_number ?? null, created_by: chat.created_by })
          .select("id")
          .single();
        if (error) throw new Error(`drive_files insert: ${error.message}`);
        fileId = data.id as string;
      }
    } catch (e) {
      await gdrive.deleteFile(up.id).catch(() => {}); // no orphan in Google Drive
      throw e;
    }
    if (existing?.google_file_id && existing.google_file_id !== up.id) {
      await gdrive
        .deleteFile(existing.google_file_id as string)
        .catch((e) => log(`chat ${chat.id}: old google file ${existing.google_file_id} not deleted: ${(e as Error).message}`));
    }
    log(`chat ${chat.id} attached ${abs} → drive_files ${fileId} google=${up.id} folder="${folderName}" (${up.size} B)${existing ? " (replaced)" : ""}`);
    return { file_id: fileId, name, mime_type: mime };
  }

  // ---------- run ----------
  async function updateChat(id: string, patch: Record<string, unknown>) {
    const { error } = await db.from("chats").update(patch).eq("id", id);
    if (error) throw new Error(`chats ${id}: ${error.message}`);
  }

  async function insertAssistant(chatId: string, m: Record<string, unknown>) {
    const { error } = await db.from("chat_messages").insert({ chat_id: chatId, role: "assistant", ...m });
    if (error) throw new Error(`chat_messages insert: ${error.message}`);
  }

  // Idle, then back to queued if user messages arrived after consumed_at. (Ordering: a chat_send that commits after
  // the idle update queues the chat itself; one before it is seen by the count.)
  async function finishIdle(chatId: string, consumedAt: string | null, patch: Record<string, unknown>) {
    await updateChat(chatId, { ...LIVE_CLEAR, ...patch, status: "idle", updated_at: now() });
    let q = db.from("chat_messages").select("id", { count: "exact", head: true }).eq("chat_id", chatId).eq("role", "user");
    if (consumedAt) q = q.gt("created_at", consumedAt);
    const { count } = await q;
    if (count) {
      await db.from("chats").update({ status: "queued" }).eq("id", chatId).eq("status", "idle");
      log(`chat ${chatId} has ${count} pending message(s): re-queued`);
    }
  }

  async function processChat(chat: Chat) {
    const t0 = Date.now();
    const tag = `chat ${chat.id}`;
    const prevCost = Number(chat.cost_usd ?? 0) || 0;

    if (chat.cancel_requested_at) {
      // Stopped right before the claim: nothing was sent; the messages stay pending ("belum terkirim").
      await updateChat(chat.id, { ...LIVE_CLEAR, status: "idle" });
      log(`${tag} stopped before start`);
      return;
    }
    await syncSkills().catch((e) => log(`skills sync: ${(e as Error).message}`));

    let pq = db.from("chat_messages").select("id, role, content, created_at").eq("chat_id", chat.id).eq("role", "user");
    if (chat.consumed_at) pq = pq.gt("created_at", chat.consumed_at);
    const { data: pend, error: pendErr } = await pq.order("created_at");
    if (pendErr) throw new Error(`chat_messages: ${pendErr.message}`);
    const pending = (pend ?? []) as Message[];
    if (!pending.length) {
      await updateChat(chat.id, { ...LIVE_CLEAR, status: "idle" });
      log(`${tag} claimed with no pending messages → idle`);
      return;
    }
    const consumedAt = pending[pending.length - 1].created_at;
    await updateChat(chat.id, { consumed_at: consumedAt });
    const skills = await enabledSkillNames();
    const input = pending.map((m) => rewriteSkill(m.content.trim(), skills)).join("\n\n");
    log(`${tag} start: ${pending.length} message(s), resume=${!!chat.session_id}`);

    const live = liveWriter({
      db, table: "chats", id: chat.id, guard: ["status", "running"], markers: MARKERS, log,
      fields: ({ steps, text }) => ({ run_steps: steps, stream_text: text }),
    });
    current = { id: chat.id, steps: () => [...live.steps], t0 };
    const done = () => ({ steps: [...live.steps], duration_ms: Date.now() - t0 });

    let init: Init = {};
    const stop = new AbortController();
    let stopped = false;
    let checking = false;
    const watcher = setInterval(async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const { data, error } = await db.from("chats").select("cancel_requested_at").eq("id", chat.id).maybeSingle();
        if (!error && data?.cancel_requested_at && !stopped) {
          stopped = true;
          log(`${tag} stop requested`);
          deleteRun(gw, init.run_id, log, tag);
          stop.abort();
        }
      } finally {
        checking = false;
      }
    }, CANCEL_POLL_MS);
    const hooks: Hooks = {
      onTool: (name, input) => {
        const line = progressFor(name, input, true);
        log(`${tag} tool ${name}: ${typeof input === "string" ? input : JSON.stringify(input)?.slice(0, 120)} → ${line ?? "-"}`);
        live.step(line);
      },
      onText: (t) => live.addText(t),
      onInit: (i) => {
        init = i;
        if (stopped) deleteRun(gw, init.run_id, log, tag);
      },
      signal: stop.signal,
    };

    live.step("Memulai…");
    let req: Req = chat.session_id ? { prompt: input, session_id: chat.session_id } : { prompt: input };
    let run: RunResp;
    try {
      try {
        run = await callGateway(gw, req, hooks);
      } catch (e) {
        // Session gone (gateway reset / other key): new session with the recent conversation replayed.
        if ((e as { status?: number }).status === 404 && req.session_id && !stopped) {
          log(`${tag} session ${req.session_id} not found, starting a new session`);
          req = { prompt: (await transcript(chat.id, chat.consumed_at)) + input };
          run = await callGateway(gw, req, hooks);
        } else throw e;
      }
    } catch (e) {
      clearInterval(watcher);
      await live.close();
      const sid = init.session_id ?? (e as { session_id?: string }).session_id ?? req.session_id ?? null;
      if (stopped) {
        await insertAssistant(chat.id, { content: live.text(), stopped: true, ...done() });
        // Stop: idle; messages sent meanwhile stay pending until the user sends again / "Kirim sekarang".
        await updateChat(chat.id, { ...LIVE_CLEAR, status: "idle", session_id: sid, error_msg: null, updated_at: now() });
        log(`${tag} stopped by user after ${((Date.now() - t0) / 1000).toFixed(0)}s (run ${init.run_id ?? "-"})`);
        return;
      }
      if (e instanceof RetryLater) {
        log(`${tag} ${e.message}; re-queuing`);
        await updateChat(chat.id, { ...LIVE_CLEAR, status: "queued", consumed_at: chat.consumed_at });
        await sleep(30_000);
        return;
      }
      const name = (e as Error).name;
      const msg = name === "TimeoutError" || name === "AbortError" ? `timeout setelah ${gw.timeoutMs / 1000} dtk` : (e as Error).message;
      log(`${tag} failed after ${((Date.now() - t0) / 1000).toFixed(0)}s: ${msg}`);
      await insertAssistant(chat.id, { content: live.text(), error: msg.slice(0, 500), ...done() });
      await updateChat(chat.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg.slice(0, 1000), session_id: sid, updated_at: now() });
      return;
    }
    clearInterval(watcher); // finished: a late Stop is ignored (cancel_requested_at is cleared below)

    const sessionId = run.session_id ?? req.session_id ?? chat.session_id;
    const cost = nextCost(prevCost, run, req.session_id);
    const finalText = run.text ?? "";
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (run.is_error) {
      const msg = `agent run error: ${finalText.slice(0, 400)}`;
      await live.close();
      await insertAssistant(chat.id, { content: live.text(), error: msg, ...done() });
      await updateChat(chat.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg, session_id: sessionId, cost_usd: cost, updated_at: now() });
      log(`${tag} failed after ${secs}s: ${msg}`);
      return;
    }
    // The answer = every streamed text block (what the user saw live; the `result` text is only the LAST block, so
    // an answer split around a tool call would lose its first part), plus the result text if it was not streamed.
    // ATTACH lines may sit in any block.
    const attachReqs = parseAttach([...live.blocks, finalText].join("\n"));
    const finalVisible = visibleText(finalText, MARKERS);
    let content = live.text();
    if (finalVisible && !content.includes(finalVisible)) content = content ? `${content}\n\n${finalVisible}` : finalVisible;
    const attachments: Attachment[] = [];
    if (attachReqs.length) {
      live.step("Mengunggah ke Google Drive…");
      await live.flushNow();
      const errors: string[] = [];
      for (const a of attachReqs) {
        try {
          attachments.push(await attachOne(chat, a));
        } catch (e) {
          log(`${tag} attach ${a.path} failed: ${(e as Error).message}`);
          errors.push(`- \`${path.basename(a.path)}\`: ${(e as Error).message}`);
        }
      }
      if (errors.length) content += `\n\n**Gagal melampirkan file:**\n${errors.join("\n")}`;
    }
    await live.close();
    await insertAssistant(chat.id, { content, attachments: attachments.length ? attachments : null, ...done() });
    await finishIdle(chat.id, consumedAt, { session_id: sessionId, cost_usd: cost, error_msg: null });
    log(`${tag} done after ${secs}s cost=$${run.cost_usd ?? 0} attachments=${attachments.length}`);
  }

  // Runs left `running` by a previous process (startup: all of them) or stuck longer than STALE_MINUTES.
  async function resetStale(all: boolean) {
    let q = db.from("chats").select("id, run_steps, started_at").eq("status", "running");
    if (!all) q = q.lt("started_at", new Date(Date.now() - STALE_MINUTES * 60_000).toISOString());
    const { data, error } = await q;
    if (error) return log(`chat resetStale: ${error.message}`);
    for (const c of data ?? []) {
      if (c.id === current?.id) continue;
      const msg = "Worker dimulai ulang / macet saat menjawab. Silakan coba lagi.";
      await insertAssistant(c.id, { content: "", error: msg, steps: c.run_steps ?? null }).catch(() => {});
      await updateChat(c.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg, updated_at: now() }).catch(() => {});
      log(`chat ${c.id} reset (was running since ${c.started_at})`);
    }
  }

  async function run() {
    log(`chat loop up: gateway=${gw.url} workdir=${workdir}`);
    await resetStale(true);
    await syncSkills().catch((e) => log(`skills sync: ${(e as Error).message}`));
    let lastSkills = Date.now();
    let lastStale = Date.now();
    while (!stopping) {
      try {
        if (Date.now() - lastSkills > SKILLS_SYNC_MS) {
          lastSkills = Date.now();
          await syncSkills().catch((e) => log(`skills sync: ${(e as Error).message}`));
        }
        if (Date.now() - lastStale > 5 * 60_000) {
          lastStale = Date.now();
          await resetStale(false);
        }
        const { data, error } = await db.rpc("claim_chat_run");
        if (error) throw new Error(`claim_chat_run: ${error.message}`);
        const chat = (Array.isArray(data) ? data[0] : data) as Chat | undefined;
        if (chat?.id) {
          try {
            await processChat(chat);
          } catch (e) {
            const msg = (e as Error).message;
            log(`chat ${chat.id} error: ${msg}`);
            await updateChat(chat.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg.slice(0, 1000), updated_at: now() }).catch(() => {});
          } finally {
            current = null;
          }
          continue;
        }
      } catch (e) {
        log(`chat loop error: ${(e as Error).message}`);
      }
      await sleep(opts.pollMs);
    }
  }

  // SIGTERM: the in-flight run dies with the process; don't leave the chat stuck in `running`.
  async function shutdown() {
    stopping = true;
    if (!current) return;
    const msg = "Worker dimulai ulang saat menjawab. Silakan coba lagi.";
    await insertAssistant(current.id, { content: "", error: msg, steps: current.steps(), duration_ms: Date.now() - current.t0 }).catch(() => {});
    await updateChat(current.id, { ...LIVE_CLEAR, status: "failed", error_msg: msg, updated_at: now() }).catch((e) =>
      log(`could not mark chat ${current?.id} failed: ${(e as Error).message}`),
    );
  }

  return { run, shutdown, syncSkills };
}
