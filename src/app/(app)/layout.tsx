import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/features/shell/components/AppShell";
import type { Member } from "@/features/tasks/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // The login's profile (docs/ACCOUNTS.md): the task member linked to this email, if any.
  const email = (user.email ?? "").toLowerCase();
  const { data: me } = email
    ? await supabase.from("task_members").select("*").eq("email", email).maybeSingle()
    : { data: null };

  return (
    <AppShell userEmail={email} me={(me as Member | null) ?? null}>
      {children}
    </AppShell>
  );
}
