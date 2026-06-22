import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getDiscordSettings } from "@/lib/integrations/discord";
import { DiscordSettingsForm } from "@/features/settings/components/DiscordSettingsForm";
import { McpTokensCard } from "@/features/mcp-tokens/components/McpTokensCard";

export const dynamic = "force-dynamic";

const MAX_W = 880;

export default async function SettingsPage() {
  const settings = await getDiscordSettings();

  return (
    <Box sx={{ minHeight: "100%", bgcolor: "#F0F4F9", py: { xs: 3, md: 5 } }}>
      <Box sx={{ maxWidth: MAX_W, mx: "auto", px: 3 }}>
        <Typography
          component="h1"
          sx={{ fontSize: "1.5rem", fontWeight: 400, color: "#1F1F1F", lineHeight: 1.3 }}
        >
          Settings
        </Typography>
        <Typography sx={{ fontSize: "0.8125rem", color: "#5f6368", mb: 3 }}>
          Integrations & notifications
        </Typography>

        <DiscordSettingsForm initial={settings} />
        <McpTokensCard />
      </Box>
    </Box>
  );
}
