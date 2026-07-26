import type { Metadata } from "next";
import { Open_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Matches mn.gov's own body font.
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "North Star Neighbors",
  description: "Anonymous, map-first mutual aid logistics for the Twin Cities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between bg-mn-blue px-4 shadow-sm">
          <Link href="/" className="font-semibold text-white">
            North Star Neighbors - Mutual Aid Network
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-white/85">
            <Link href="/?drop=1" className="hover:text-mn-green">
              Add Drop
            </Link>
            <Link href="/manage" className="hover:text-mn-green">
              My Drops
            </Link>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
