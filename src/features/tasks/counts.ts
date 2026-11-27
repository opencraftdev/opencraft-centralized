// Shared by the server page and the browser client (no Supabase import here).

/** Tallies task_comments rows ({ task_id }) into a count per task. */
export function countComments(rows: { task_id: string }[] | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows ?? []) out[r.task_id] = (out[r.task_id] ?? 0) + 1;
  return out;
}
