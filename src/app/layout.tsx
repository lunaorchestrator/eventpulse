import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/auth-context";
import { Navbar } from "@/components/navbar";
import DemoModeBanner from "@/components/demo-mode-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EventPulse — Event Management & Ticketing",
  description: "Discover, create, and manage events with ease. Buy tickets, check in with QR codes, and track attendance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-200 bg-white py-8">
            <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} EventPulse. All rights reserved.
            </div>
          </footer>
        </AuthProvider>
      <DemoModeBanner />
      </body>
    </html>
  );
}
