// scripts/seed-local.mjs
// Rebuild local Supabase from a named CSV dataset.
//
//   node scripts/seed-local.mjs --dataset=dummy              # dry-run
//   node scripts/seed-local.mjs --dataset=dummy --force      # truncate + reseed
//   node scripts/seed-local.mjs --dataset=original           # dry-run
//
// Idempotent: safe to re-run. Respects FK order.
// Uses @supabase/supabase-js (already a dependency).

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---- env loader -----------------------------------------------------
function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
         || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  console.error("Run `npx supabase start` and copy the keys from `npx supabase status`.");
  process.exit(1);
}

const schemaOption = process.argv.find(arg => arg.startsWith("--schema="));
const SCHEMA = schemaOption ? schemaOption.slice("--schema=".length) : "public";
const supabase = createClient(url, key, { db: { schema: SCHEMA } });
const FORCE = process.argv.includes("--force");
const datasetOption = process.argv.find(arg => arg.startsWith("--dataset="));
const DATASET = datasetOption ? datasetOption.slice("--dataset=".length) : "dummy";
if (DATASET !== "original" && DATASET !== "dummy") {
  console.error(`Unknown dataset "${DATASET}". Use --dataset=original or --dataset=dummy.`);
  process.exit(1);
}
const DATA_DIR = path.join(process.cwd(), "scripts", `seed-data-${DATASET}`);

// ---- tiny CSV parser (handles quoted commas, CRLF) ------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // strip BOM if present
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];

  const header = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ""))
    .map(r => {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
}

function readCsv(name) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) {
    console.warn(`  [WARN] ${name} not found, skipping.`);
    return null;
  }
  return parseCsv(fs.readFileSync(p, "utf-8"));
}

// ---- helpers --------------------------------------------------------
const clean = v => (v === "" || v === "null" || v === undefined) ? null : v;
const cleanBool = v => v === "true" ? true : v === "false" ? false : null;
const cleanInt = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };

async function chunkInsert(table, rows, chunkSize = 200) {
  let inserted = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`    FAIL ${table} rows ${i}..${i + chunk.length}: ${error.message}`);
      failed += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }
  return { inserted, failed };
}

// Count rows in any table. Composite-PK tables (faculty_topics,
// session_coordinators) don't have an `id` column, so we count `*`
// and only use `head: true` (no row payload).
async function count(table) {
  const { count: n, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return error ? -1 : n;
}

// ---- main -----------------------------------------------------------
async function main() {
  console.log(`Supabase target: ${url}`);
  console.log(`Schema: ${SCHEMA}`);
  console.log(`Dataset: ${DATASET} (${DATA_DIR})`);
  console.log(`Mode: ${FORCE ? "APPLY (--force)" : "DRY RUN (no writes)"}\n`);

  // Read all CSVs first so a missing file aborts before we truncate
  const facultyCsv     = readCsv("faculty_rows.csv");
  const sessionsCsv    = readCsv("conference_sessions_rows.csv");
  const topicsCsv      = readCsv("session_topics_rows.csv");
  const coordinatorsCsv= readCsv("session_coordinators_rows.csv");
  const linksCsv       = readCsv("faculty_topics_rows.csv");

  console.log("Source files:");
  console.log(`  faculty_rows.csv               : ${facultyCsv?.length ?? 0} rows`);
  console.log(`  conference_sessions_rows.csv   : ${sessionsCsv?.length ?? 0} rows`);
  console.log(`  session_topics_rows.csv        : ${topicsCsv?.length ?? 0} rows`);
  console.log(`  session_coordinators_rows.csv  : ${coordinatorsCsv?.length ?? 0} rows`);
  console.log(`  faculty_topics_rows.csv        : ${linksCsv?.length ?? 0} rows`);

  console.log("\nCurrent DB counts:");
  for (const t of ["faculty", "conference_sessions", "session_topics", "session_coordinators", "faculty_topics"]) {
    console.log(`  ${t.padEnd(24)}: ${await count(t)}`);
  }

  if (!FORCE) {
    console.log("\nDry run - no changes. Re-run with --force to apply:");
    console.log(DATASET === "original"
      ? "  npm run seed:local:original:apply"
      : "  npm run seed:local:apply");
    return;
  }

  // ---- 1. Truncate in reverse FK order -----------------------------
  console.log("\nTruncating tables (reverse FK order)...");
  // PostgREST requires a filter for DELETE; use a never-matching one
  const NEVER = "00000000-0000-0000-0000-000000000000";
  for (const t of ["faculty_topics", "session_coordinators", "session_topics", "conference_sessions", "faculty"]) {
    // faculty_topics has composite PK, so use faculty_id; others use id
    const col = (t === "faculty_topics" || t === "session_coordinators") ? (t === "faculty_topics" ? "faculty_id" : "session_id") : "id";
    const { error } = await supabase.from(t).delete().neq(col, NEVER);
    if (error) {
      console.error(`  FAIL truncate ${t}: ${error.message}`);
      // try to continue - some rows may still exist
    } else {
      console.log(`  truncated ${t}`);
    }
  }

  // ---- 2. Insert faculty -------------------------------------------
  console.log("\nInserting faculty...");
  const facultyRows = (facultyCsv || []).map(r => ({
    id:              r.id,
    faculty_id:      clean(r.faculty_id),
    canonical_name:  clean(r.canonical_name) || "Unknown",
    first_name:      clean(r.first_name),
    last_name:       clean(r.last_name),
    email:           clean(r.email),
    alt_email:       clean(r.alt_email),
    phone:           clean(r.phone),
    country:         clean(r.country),
    designation:     clean(r.designation),
    person_type:     clean(r.person_type),
    is_active:       cleanBool(r.is_active) ?? true,
    is_faculty:      cleanBool(r.is_faculty) ?? false,
    is_coordinator:  cleanBool(r.is_coordinator) ?? false,
    google_confirmed:cleanBool(r.google_confirmed) ?? false,
    google_email:    clean(r.google_email),
    google_phone:    clean(r.google_phone),
    email_sent:      cleanBool(r.email_sent) ?? false,
    email_sent_date: clean(r.email_sent_date),
    reminder_sent:   cleanBool(r.reminder_sent) ?? false,
    whatsapp_sent:   cleanBool(r.whatsapp_sent) ?? false,
    sessions_as_faculty: cleanInt(r.sessions_as_faculty),
    google_form_sync_date: clean(r.google_form_sync_date),
  }));
  if (facultyRows.length > 0) {
    const r = await chunkInsert("faculty", facultyRows);
    console.log(`  inserted: ${r.inserted}, failed: ${r.failed}`);
  }

  // ---- 3. Insert sessions ------------------------------------------
  console.log("\nInserting conference_sessions...");
  const sessionRows = (sessionsCsv || []).map(r => ({
    id:            r.id,
    session_code:  clean(r.session_code),
    session_name:  clean(r.session_name),
    session_date:  clean(r.session_date),
    start_time:    clean(r.start_time),
    end_time:      clean(r.end_time),
    hall:          clean(r.hall),
    session_type:  clean(r.session_type),
  }));
  if (sessionRows.length > 0) {
    const r = await chunkInsert("conference_sessions", sessionRows);
    console.log(`  inserted: ${r.inserted}, failed: ${r.failed}`);
  }

  // ---- 4. Insert topics --------------------------------------------
  console.log("\nInserting session_topics...");
  const topicRows = (topicsCsv || []).map(r => ({
    id:          r.id,
    session_id:  clean(r.session_id),
    topic_title: clean(r.topic_title),
    start_time:  clean(r.start_time),
    end_time:    clean(r.end_time),
    sequence_no: cleanInt(r.sequence_no),
  }));
  if (topicRows.length > 0) {
    const r = await chunkInsert("session_topics", topicRows);
    console.log(`  inserted: ${r.inserted}, failed: ${r.failed}`);
  }

  // ---- 5. Insert coordinators --------------------------------------
  console.log("\nInserting session_coordinators...");
  const coordRows = (coordinatorsCsv || []).map(r => ({
    session_id: clean(r.session_id),
    faculty_id: clean(r.faculty_id),
    role:       clean(r.role),
    coord_id:   cleanInt(r.coord_id),
  })).filter(r => r.session_id && r.faculty_id);
  if (coordRows.length > 0) {
    const r = await chunkInsert("session_coordinators", coordRows);
    console.log(`  inserted: ${r.inserted}, failed: ${r.failed}`);
  }

  // ---- 6. Insert faculty_topics ------------------------------------
  console.log("\nInserting faculty_topics...");
  const linkRows = (linksCsv || []).map(r => ({
    faculty_id: clean(r.faculty_id),
    topic_id:   clean(r.topic_id),
    role:       clean(r.role) || "Faculty",
  })).filter(r => r.faculty_id && r.topic_id);
  if (linkRows.length > 0) {
    const r = await chunkInsert("faculty_topics", linkRows);
    console.log(`  inserted: ${r.inserted}, failed: ${r.failed}`);
  }

  // ---- 7. Verify + resequence --------------------------------------
  console.log("\nFinal DB counts:");
  for (const t of ["faculty", "conference_sessions", "session_topics", "session_coordinators", "faculty_topics"]) {
    console.log(`  ${t.padEnd(24)}: ${await count(t)}`);
  }

  console.log("\nApplying resequence_session() to all sessions...");
  const { data: sess } = await supabase.from("conference_sessions").select("id, session_code");
  let reseqCount = 0;
  for (const s of sess || []) {
    const { error } = await supabase.rpc("resequence_session", { p_session_id: s.id });
    if (!error) reseqCount++;
  }
  console.log(`  resequenced ${reseqCount} session(s).`);

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });