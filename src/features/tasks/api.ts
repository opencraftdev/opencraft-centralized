// Browser-side reads/writes for /tasks (docs/TASKS.md). RLS: is_allowed_user() — the whole team edits everything.
import { createClient } from "@/lib/supabase/client";
import type { Member, Project, Task, TaskComment, TaskInput } from "./types";

const sb = () => createClient();

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export interface TaskData {
  members: Member[];
  projects: Project[];
  tasks: Task[];
}

export async function loadTaskData(): Promise<TaskData> {
  const c = sb();
  const [m, p, t] = await Promise.all([
    c.from("task_members").select("*").order("sort").order("name"),
    c.from("task_projects").select("*").order("sort").order("name"),
    c.from("tasks").select("*").order("sort").order("created_at"),
  ]);
  return {
    members: check(m) as Member[],
    projects: check(p) as Project[],
    tasks: check(t) as Task[],
  };
}

export async function createTask(input: Partial<TaskInput> & { title: string }): Promise<Task> {
  return check(await sb().from("tasks").insert(input).select("*").single()) as Task;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  check(await sb().from("tasks").update(patch).eq("id", id));
}

export async function deleteTask(id: string): Promise<void> {
  check(await sb().from("tasks").delete().eq("id", id));
}

export async function listComments(taskId: string): Promise<TaskComment[]> {
  return check(
    await sb().from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
  ) as TaskComment[];
}

export async function addComment(taskId: string, body: string): Promise<void> {
  check(await sb().from("task_comments").insert({ task_id: taskId, body }));
}

export async function deleteComment(id: string): Promise<void> {
  check(await sb().from("task_comments").delete().eq("id", id));
}

/** Creates (no id) or updates a member; returns its id. */
export async function saveMember(m: Partial<Member> & { name: string }): Promise<string> {
  const { id, ...rest } = m;
  if (id) {
    check(await sb().from("task_members").update(rest).eq("id", id));
    return id;
  }
  const row = check(await sb().from("task_members").insert(rest).select("id").single()) as { id: string };
  return row.id;
}

export async function saveProject(p: Partial<Project> & { name: string }): Promise<void> {
  const { id, ...rest } = p;
  if (id) check(await sb().from("task_projects").update(rest).eq("id", id));
  else check(await sb().from("task_projects").insert(rest));
}

/** Calls onChange whenever any task table changes (other team members' edits). Returns unsubscribe. */
export function subscribeTasks(onChange: () => void): () => void {
  const c = sb();
  const ch = c
    .channel("tasks-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "task_members" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "task_projects" }, onChange)
    .subscribe();
  return () => {
    void c.removeChannel(ch);
  };
}
