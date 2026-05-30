import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/features/content/components/Sidebar";
import { TopBar } from "@/features/content/components/TopBar";
import Box from "@mui/material/Box";

const SIDEBAR_WIDTH = 280;
const TOPBAR_HEIGHT = 64;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar userEmail={user.email ?? ""} />
      <Sidebar userEmail={user.email ?? ""} />
      <Box
        component="main"
        sx={{
          ml: `${SIDEBAR_WIDTH}px`,
          mt: `${TOPBAR_HEIGHT}px`,
          height: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
          overflow: "auto",
          bgcolor: "background.default",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
