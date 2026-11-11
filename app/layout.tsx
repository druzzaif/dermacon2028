import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import NavLinks from "./components/NavLinks";
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
    default: "DERMACON 2028 Dashboard",
    template: "%s · DERMACON 2028",
  },
  description: "Automated system for scientific commitments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            className="shrink-0 text-[15px] font-semibold tracking-[0.12em] text-white"
          >
            DERMACON <span className="text-indigo-300">2028</span>
          </Link>
          <NavLinks />
        </header>
        <div className="pt-14">{children}</div>
      </body>
    </html>
  );
}
