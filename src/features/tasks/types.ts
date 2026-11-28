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
  photo_file_id?: string | null; // profile photo (drive_files id), migration 027
}

export interface Project {
  id: string;
  name: string;
  label: string;
  color: string;
  status: ProjectStatus;
  sort: number;
  emoji?: string; // migration 027
  logo_file_id?: string | null; // custom logo (drive_files id), migration 027
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
  pic_ids?: string[]; // all PICs, first = main (migration 033; absent before it runs)
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

// dot: the light colour used for status dots; color + bg: text and fill of status pills (darker, readable).
export const STATUSES: { value: TaskStatus; label: string; dot: string; color: string; bg: string }[] = [
  { value: "todo", label: "To do", dot: "#BDC1C6", color: "#5F6368", bg: "#F1F3F4" },
  { value: "in_progress", label: "Progress", dot: "#FDD663", color: "#8A5A00", bg: "#FEF7E0" },
  { value: "review", label: "Review", dot: "#FA903E", color: "#A14A00", bg: "#FEEFE3" },
  { value: "done", label: "Done", dot: "#81C995", color: "#146C2E", bg: "#E6F4EA" },
];

export const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#80868B" },
  { value: "medium", label: "Medium", color: "#0B57D0" },
  { value: "high", label: "High", color: "#E37400" },
  { value: "urgent", label: "Urgent", color: "#D93025" },
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
  | "pic_ids"
  | "start_date"
  | "due_date"
  | "is_milestone"
  | "is_optional"
  | "sort"
>;

/** Everyone who is PIC of a task (pic_ids, or the single assignee before migration 033). */
export function picsOf(t: Pick<Task, "assignee_id" | "pic_ids">): string[] {
  if (t.pic_ids && t.pic_ids.length) return t.pic_ids;
  return t.assignee_id ? [t.assignee_id] : [];
}
