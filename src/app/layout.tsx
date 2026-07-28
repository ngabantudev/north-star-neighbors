import type { Metadata, Viewport } from "next";
import { Open_Sans, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { AppNav } from "@/components/AppNav";
import { ActivityFeed } from "@/components/ActivityFeed";
import { WeatherLayerProvider } from "@/components/WeatherLayerProvider";
import "./globals.css";

// Matches state civic typography standards
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#003865',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <WeatherLayerProvider>
          <header className="flex h-14 shrink-0 items-center justify-between bg-mn-blue px-4 shadow-sm">
            <Link href="/" className="font-semibold text-white text-sm sm:text-base truncate mr-2">
              North Star Neighbors
            </Link>
            <AppNav />
          </header>
          <main className="flex flex-1 flex-col">{children}</main>
          {/* Fixed overlay, deliberately outside the layout flow — no page
              has to budget height for it. */}
          <ActivityFeed />
        </WeatherLayerProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}