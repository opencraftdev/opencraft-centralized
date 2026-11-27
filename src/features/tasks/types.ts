// Task Management (docs/TASKS.md). Rows of supabase/migrations/026_tasks.sql.

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "parked" | "done";

export interface Member {
  id: string;
  name: string;
  initials: string;
  role: string;
  color: string;
  email: string | null;
  goal: string;
  sort: number;
  active: boolean;
}

export interface Project {
  id: string;
  name: string;
  label: string;
  color: string;
  status: ProjectStatus;
  sort: number;
}

export interface Task {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  helper_ids: string[];
  start_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  is_milestone: boolean;
  is_optional: boolean;
  sort: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  author_email: string | null;
  created_at: string;
}

export const STATUSES: { value: TaskStatus; label: string; color: string; bg: string }[] = [
  { value: "todo", label: "Belum mulai", color: "#5F6368", bg: "#F1F3F4" },
  { value: "in_progress", label: "Dikerjakan", color: "#0B57D0", bg: "#D3E3FD" },
  { value: "review", label: "Review", color: "#8E4B00", bg: "#FFE8C2" },
  { value: "done", label: "Selesai", color: "#146C2E", bg: "#C4EED0" },
];

export const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Rendah", color: "#80868B" },
  { value: "medium", label: "Sedang", color: "#0B57D0" },
  { value: "high", label: "Tinggi", color: "#E37400" },
  { value: "urgent", label: "Mendesak", color: "#D93025" },
];

export const statusMeta = (s: TaskStatus) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
export const priorityMeta = (p: TaskPriority) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];

/** Editable fields of a task (what the dialog / quick actions send). */
export type TaskInput = Pick<
  Task,
  | "project_id"
  | "parent_id"
  | "title"
  | "description"
  | "status"
  | "priority"
  | "assignee_id"
  | "helper_ids"
  | "start_date"
  | "due_date"
  | "is_milestone"
  | "is_optional"
  | "sort"
>;
