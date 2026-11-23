import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DriveFile, DriveFolder } from "@/lib/drive/types";
import { Drive } from "@/features/drive/components/Drive";

export const dynamic = "force-dynamic";

// Google-Drive style document store (docs/DRIVE.md). Initial data is fetched here; the client
// component then refreshes through the browser Supabase client after mutations / while polling.
export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [folders, files] = await Promise.all([
    supabase.from("drive_folders").select("*"),
    supabase.from("drive_files").select("*"),
  ]);
  if (folders.error) throw folders.error;
  if (files.error) throw files.error;

  return (
    <Suspense>
      <Drive
        initialFolders={(folders.data ?? []) as DriveFolder[]}
        initialFiles={(files.data ?? []) as DriveFile[]}
        userId={user.id}
      />
    </Suspense>
  );
}
