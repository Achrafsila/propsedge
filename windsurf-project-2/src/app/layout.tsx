import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { AccountsProvider } from "@/context/AccountsContext";
import { AdminProvider } from "@/context/AdminContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PropsFirm Manager",
  description: "Modern Prop Firm Management Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-black text-white">
        <AccountsProvider>
          <AdminProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col">
                <TopNav />
                <main className="relative flex-1 p-6 overflow-auto">
                  {/* Sui-style electric-blue top glow */}
                  <div
                    aria-hidden
                    className="pointer-events-none fixed inset-x-0 top-0 h-[420px] z-0"
                    style={{ background: 'radial-gradient(80% 60% at 50% -10%, rgba(41,141,255,0.18) 0%, rgba(41,141,255,0) 60%)' }}
                  />
                  <div className="relative z-10">
                    {children}
                  </div>
                </main>
              </div>
            </div>
          </AdminProvider>
        </AccountsProvider>
      </body>
    </html>
  );
}
