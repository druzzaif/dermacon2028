import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "DERMACON 2028 Dashboard",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
        suppressHydrationWarning
      >
        <header className="fixed top-0 left-0 right-0 h-12 bg-gray-800 text-white z-50 flex items-center px-5 shadow-sm">
          <Link
            href="/sessions"
            className="font-bold tracking-wide text-base hover:text-blue-300 transition-colors"
          >
            DERMACON 2028
          </Link>
          <nav className="ml-8 flex items-center gap-5 text-sm font-medium">
            <Link href="/" className="text-gray-200 hover:text-white transition-colors">
              Faculty
            </Link>
            <Link href="/sessions" className="text-gray-200 hover:text-white transition-colors">
              Sessions
            </Link>
            <Link href="/overlaps" className="text-gray-200 hover:text-white transition-colors">
              Overlaps
            </Link>
          </nav>
        </header>
        <div className="pt-12">{children}</div>
      </body>
    </html>
  );
}
