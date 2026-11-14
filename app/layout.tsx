import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { cookies } from "next/headers";
import NavLinks from "./components/NavLinks";
import DemoToggle from "./components/DemoToggle";
import BackButton from "./components/BackButton";
import { MODE_COOKIE } from "./lib/mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "DERMACON 2027",
    template: "%s · DERMACON 2027",
  },
  description: "Automated system for scientific commitments",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mode = (await cookies()).get(MODE_COOKIE)?.value === "demo" ? "demo" : "live";
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-pop"
        >
          Skip to main content
        </a>
        <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-white/10 bg-header px-4 text-white sm:px-6">
          <Link
            href="/sessions"
            aria-label="DERMACON 2027, go to Sessions"
            className="flex shrink-0 items-baseline gap-1.5 rounded-md text-[15px] font-semibold tracking-[0.1em] text-white"
          >
            DERMACON <span className="font-medium tracking-[0.06em] text-indigo-300">2027</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <BackButton />
            <DemoToggle mode={mode} />
          </div>
        </header>
        {mode === "demo" && (
          <div className="fixed inset-x-0 top-14 z-40 bg-amber-400 py-0.5 text-center text-[11px] font-semibold tracking-wide text-slate-900">
            DEMO MODE — sample data only. Changes here are saved separately and never touch your real data.
          </div>
        )}
        <div className={mode === "demo" ? "pt-[4.5rem]" : "pt-14"}>{children}</div>
      </body>
    </html>
  );
}
