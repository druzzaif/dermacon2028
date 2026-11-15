import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import AppChrome from "./components/AppChrome";
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
        <AppChrome mode={mode}>{children}</AppChrome>
      </body>
    </html>
  );
}
