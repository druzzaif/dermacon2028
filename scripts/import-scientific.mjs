// scripts/import-scientific.mjs
// ADDITIVE import of the scientific-programme session skeleton (5-7 Feb 2027).
// Sessions only: topics and faculty are added later in the app.
// Never deletes or overwrites existing rows.
//
//   node scripts/import-scientific.mjs            # dry run, no writes
//   node scripts/import-scientific.mjs --apply    # write to the database
//
// Source: scripts/seed-data-scientific/sessions.csv
//   code          SP<day>-<sheet row>, e.g. SP5-01 (day of the month + row in the organiser's sheet)
//   type          Hall "All" -> Plenary, everything else -> Scientific Programme
//   sponsor       appended to the name: "Hyperpigmentation Decoded (Eucerin)"
//                 ("[ASK: SPONSOR]" placeholders are ignored)
//   blank times   stay blank (the Missing data report lists them)
//   Lunch rows    skipped (not a programme session; its time is assumed)
//   Notes column  stays in the CSV only (sessions have no notes field)

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

for (const l of fs.readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const APPLY = process.argv.includes("--apply");
const rows = parse(fs.readFileSync(path.join(process.cwd(), "scripts", "seed-data-scientific", "sessions.csv"), "utf8"),
  { columns: true, bom: true, skip_empty_lines: true, trim: true });

const orNull = (v) => (v === "" || v == null ? null : v);
const time = (v) => (v ? `${v}:00` : null);

const plan = [];
const skipped = [];
for (const r of rows) {
  if (/^lunch$/i.test(r["Session Name"])) { skipped.push(`${r.Date} row ${r.Row} Lunch`); continue; }
  const sponsor = r.Sponsor && !r.Sponsor.startsWith("[") ? r.Sponsor : "";
  const day = Number(r.Date.slice(8, 10));
  plan.push({
    session_code: `SP${day}-${String(r.Row).padStart(2, "0")}`,
    session_name: sponsor ? `${r["Session Name"]} (${sponsor})` : r["Session Name"],
    session_date: r.Date,
    hall: r.Hall,
    start_time: time(r.Start),
    end_time: time(r.End),
    session_type: r.Hall.toLowerCase() === "all" ? "Plenary" : "Scientific Programme",
  });
}

const dupes = plan.map((p) => p.session_code).filter((c, i, a) => a.indexOf(c) !== i);
if (dupes.length) throw new Error(`Duplicate codes in CSV: ${dupes.join(", ")}`);

const { data: existing, error } = await sb.from("conference_sessions").select("session_code").like("session_code", "SP%");
if (error) throw new Error(error.message);
const have = new Set(existing.map((e) => e.session_code));
const todo = plan.filter((p) => !have.has(p.session_code));

console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (no writes)"}`);
console.log(`In CSV: ${rows.length} rows | skipped: ${skipped.length} (${skipped.join("; ")}) | already in DB: ${plan.length - todo.length} | to add: ${todo.length}`);
for (const d of ["2027-02-05", "2027-02-06", "2027-02-07"]) {
  const l = todo.filter((p) => p.session_date === d);
  const blank = l.filter((p) => !p.start_time || !p.end_time).length;
  console.log(`  ${d}: ${l.length} sessions (${l.filter((p) => p.session_type === "Plenary").length} plenary, ${blank} with a blank time)`);
}
const halls = [...new Set(todo.map((p) => p.hall))];
console.log(`  halls: ${halls.join(" | ")}`);
if (!APPLY) { console.log("\nDry run only. Re-run with --apply to write."); process.exit(0); }
if (!todo.length) { console.log("Nothing to add."); process.exit(0); }

const { error: insErr } = await sb.from("conference_sessions").insert(todo);
if (insErr) { console.error(`FAILED (nothing was added): ${insErr.message}`); process.exit(1); }
console.log(`\nInserted ${todo.length} sessions.`);
