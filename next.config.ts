import type { NextConfig } from "next";

// Where the local Supabase (Docker) listens, as seen from this PC
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "*.app.github.dev",
      ],
    },
  },
  // Browsers (PC, phone, iPad) reach the database through the app at /sb/...,
  // so other devices only need port 3000, not Supabase's port.
  async rewrites() {
    return [{ source: "/sb/:path*", destination: `${SUPABASE_URL}/:path*` }];
  },
};

export default nextConfig;
