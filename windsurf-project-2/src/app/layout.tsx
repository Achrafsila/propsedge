import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AccountsProvider } from "@/context/AccountsContext";
import { AdminProvider } from "@/context/AdminContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const modernRomance = localFont({
  src: "./fonts/modern-romance.otf",
  variable: "--font-modern-romance",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PropEdge | Professional Prop Trading Workspace",
  description:
    "Track every challenge, funded account and payout in one intelligent workspace designed for serious prop traders.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${modernRomance.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-black text-white">
        <AuthProvider>
          <AccountsProvider>
            <AdminProvider>
              <AppShell>{children}</AppShell>
            </AdminProvider>
          </AccountsProvider>
        </AuthProvider>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
