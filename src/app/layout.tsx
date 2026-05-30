import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenCraft — Content Dashboard",
  description: "Social media content command center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <ThemeRegistry>
          {children}
          <ToastProvider />
        </ThemeRegistry>
      </body>
    </html>
  );
}
