"use client";

import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { MemberForm } from "@/features/tasks/components/TeamDialog";
import { useAccount } from "./account";

// "Edit profil" from the account menu (docs/ACCOUNTS.md → "Profile"). The profile is the login's task_members row:
// the same name, photo, role and colour show on the board (PIC), in comments and in shared chats.
export function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email, me } = useAccount();
  const router = useRouter();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "28px" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", pl: 3, pr: 1.5, pt: 2 }}>
        <Typography component="h2" sx={{ flex: 1, fontSize: "1.375rem", color: "#1F1F1F" }}>
          {me ? "Edit profil" : "Buat profil"}
        </Typography>
        <IconButton aria-label="Tutup" onClick={onClose} sx={{ color: "#444746" }}>
          <CloseRounded />
        </IconButton>
      </Box>
      {!me && (
        <Typography sx={{ px: 3, pt: 0.5, fontSize: "0.8125rem", color: "#5E5E5E" }}>
          Akun ini belum punya profil. Setelah dibuat, kamu bisa dipilih sebagai PIC di Task Management.
        </Typography>
      )}
      <Box sx={{ px: 2, pb: 2 }}>
        {open && (
          <MemberForm
            initial={me}
            lockEmail={email}
            onDone={(saved) => {
              onClose();
              if (saved) router.refresh();
            }}
          />
        )}
      </Box>
    </Dialog>
  );
}
