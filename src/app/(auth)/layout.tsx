import Box from "@mui/material/Box";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F0F4F9", display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
      {children}
    </Box>
  );
}
