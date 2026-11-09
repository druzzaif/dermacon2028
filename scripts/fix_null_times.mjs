// scripts/fix_null_times.mjs
// Convert session_topics rows with start_time / end_time = 00:00:00
// (left over from legacy imports that turned blank CSV cells into
// midnight) back to NULL.
//
// Usage:
//   node scripts\fix_null_times.mjs --dry    # show what would change
//   node scripts\fix_null_times.mjs          # apply

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY (or anon key) in .env.local.");
  console.error("Run `npx supabase status` and paste the service_role key into .env.local.");
  process.exit(1);
}

const supabase = createClient(url, key);
const DRY = process.argv.includes("--dry");

async function main() {
  console.log(`Supabase target: ${url}`);
  console.log(`Mode: ${DRY ? "DRY RUN (no writes)" : "LIVE"}\n`);

  const { data: suspects, error } = await supabase
    .from("session_topics")
    .select("id, topic_title, session_id, sequence_no, start_time, end_time")
    .or("start_time.eq.00:00:00,end_time.eq.00:00:00");

  if (error) {
    console.error("Query failed:", error.message);
    console.error("Is local Supabase running? -> npx supabase start");
    process.exit(1);
  }

  if (!suspects || suspects.length === 0) {
    console.log("No rows with 00:00:00 start_time or end_time. Nothing to do.");
    return;
  }

  console.log(`Found ${suspects.length} row(s) with a midnight time:\n`);
  for (const r of suspects) {
    const st = r.start_time || ".";
    const en = r.end_time || ".";
    const title = (r.topic_title || "").slice(0, 70);
    console.log(`  [seq ${r.sequence_no ?? "?"}] ${st} -> ${en}  ${title}`);
  }

  if (DRY) {
    console.log("\nDry run - no changes made. Run `npm run fix:null-times` to apply.");
    return;
  }

  let fixed = 0;
  for (const r of suspects) {
    const patch = {};
    if (r.start_time === "00:00:00") patch.start_time = null;
    if (r.end_time === "00:00:00") patch.end_time = null;
    if (Object.keys(patch).length === 0) continue;

    const { error: upErr } = await supabase
      .from("session_topics")
      .update(patch)
      .eq("id", r.id);

    if (upErr) {
      console.error(`  FAILED ${r.id.slice(0, 8)}: ${upErr.message}`);
    } else {
      fixed++;
      const cols = Object.keys(patch).join(", ");
      console.log(`  FIXED  ${r.id.slice(0, 8)}  cleared (${cols})`);
    }
  }
  console.log(`\nDone. ${fixed} row(s) corrected.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
