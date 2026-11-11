import type { NextConfig } from "next";
import os from "os";

// Where the local Supabase (Docker) listens, as seen from this PC
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, "");

// This PC's own network addresses (e.g. 192.168.1.14), read each time the app
// starts. `next dev` blocks its page code for any other address, so phones and
// iPads on the Wi-Fi got stuck on "Loading…" without this.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
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
