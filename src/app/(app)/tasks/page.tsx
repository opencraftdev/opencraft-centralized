import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { createClient } from "@/lib/supabase/server";
import { TasksApp } from "@/features/tasks/components/TasksApp";
import type { Member, Project, Task } from "@/features/tasks/types";
import { countComments } from "@/features/tasks/counts";

export const dynamic = "force-dynamic";

// Task Management (docs/TASKS.md).
export default async function TasksPage() {
  const supabase = await createClient();
  const [{ data: auth }, m, p, t, cm] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("task_members").select("*").order("sort").order("name"),
    supabase.from("task_projects").select("*").order("sort").order("name"),
    supabase.from("tasks").select("*").order("sort").order("created_at"),
    supabase.from("task_comments").select("task_id"),
  ]);

  const err = m.error ?? p.error ?? t.error;
  if (err) {
    // Most likely the migration (supabase/migrations/026_tasks.sql) hasn't been applied yet.
    return (
      <Box sx={{ p: 4, maxWidth: 640, mx: "auto" }}>
        <Typography component="h1" sx={{ fontSize: "1.5rem", mb: 1 }}>
          Task Management
        </Typography>
        <Typography sx={{ color: "#5F6368", fontSize: "0.9375rem" }}>
          Database untuk Task Management belum siap. Jalankan migration <code>026_tasks.sql</code> di Supabase, lalu muat ulang halaman ini.
        </Typography>
        <Typography sx={{ color: "#9AA0A6", fontSize: "0.75rem", mt: 2 }}>{err.message}</Typography>
      </Box>
    );
  }

  return (
    <TasksApp
      initial={{ members: (m.data ?? []) as Member[], projects: (p.data ?? []) as Project[], tasks: (t.data ?? []) as Task[], commentCounts: countComments(cm.data as { task_id: string }[] | null) }}
      userEmail={auth.user?.email ?? ""}
    />
  );
}
