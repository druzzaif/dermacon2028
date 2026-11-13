// scripts/import-cme.mjs
// ADDITIVE import of the CME track (sessions CME1-CME6) and its new faculty.
// Never deletes or overwrites existing rows (see "placeholder emails" below).
//
//   node scripts/import-cme.mjs            # dry run, no writes
//   node scripts/import-cme.mjs --apply    # write to the database
//
// Source files: scripts/seed-data-cme/facultylist.csv, cme_sessions.csv
//
// Mapping
//   facultylist.csv rows not yet in `faculty`   -> faculty (inserted)
//   Chairperson rows                            -> session_chairs (whole session)
//   Faculty / QA rows                           -> session_topics + faculty_topics
//   (one topic per session+time+title; both chairs share the Q&A topic, role "QA")
//   Faculty already in the DB (FAC159, FAC208, FAC034, FAC000, FAC271) are reused.
//   Placeholder emails: an existing faculty row whose email is blank or
//   "no-email-...@placeholder.com" gets the real email from the CME file.

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
const DIR = path.join(process.cwd(), "scripts", "seed-data-cme");
const readCsv = (f) =>
  parse(fs.readFileSync(path.join(DIR, f), "utf8"), { columns: true, bom: true, skip_empty_lines: true, trim: true });

const facultyCsv = readCsv("facultylist.csv");
const cmeCsv = readCsv("cme_sessions.csv");
const isPlaceholder = (e) => !e || /@placeholder\.com$/i.test(e);
const orNull = (v) => (v === "" || v == null ? null : v);
const must = (r, label) => { if (r.error) throw new Error(`${label}: ${r.error.message}`); return r.data; };

// ---- plan ----------------------------------------------------------
const ids = [...new Set([...facultyCsv.map((r) => r["Faculty ID"]), ...cmeCsv.map((r) => r["Faculty ID"])])];
const existing = must(await sb.from("faculty").select("id, faculty_id, canonical_name, email").in("faculty_id", ids), "read faculty");
const byFacId = new Map(existing.map((f) => [f.faculty_id, f]));

const newFaculty = [];
for (const r of facultyCsv) {
  if (byFacId.has(r["Faculty ID"])) continue;
  const parts = r.Name.split(/\s+/);
  const cmeEmail = cmeCsv.find((c) => c["Faculty ID"] === r["Faculty ID"])?.Email;
  newFaculty.push({
    faculty_id: r["Faculty ID"],
    canonical_name: r.Name,
    first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : r.Name,
    last_name: parts.length > 1 ? parts.at(-1) : null,
    email: orNull(r.Email),
    // If the CME file has a different address for the same person, keep it as the alternate
    alt_email: cmeEmail && r.Email && cmeEmail.toLowerCase() !== r.Email.toLowerCase() ? cmeEmail : null,
    phone: orNull(r.Phone),
    country: orNull(r.Country),
    person_type: r.Role || "Faculty",
    is_faculty: true,
    is_coordinator: false,
    is_active: true,
  });
}

const emailFixes = [];
for (const f of existing) {
  const cme = cmeCsv.find((c) => c["Faculty ID"] === f.faculty_id)?.Email;
  if (isPlaceholder(f.email) && cme && !isPlaceholder(cme)) emailFixes.push({ id: f.id, faculty_id: f.faculty_id, name: f.canonical_name, email: cme });
}

const missingIds = ids.filter((i) => !byFacId.has(i) && !newFaculty.some((n) => n.faculty_id === i));
if (missingIds.length) throw new Error(`CME file references faculty not in DB or facultylist.csv: ${missingIds.join(", ")}`);

const [dateOf] = [cmeCsv[0].Date];
const codes = [...new Set(cmeCsv.map((r) => r.Session))];
const existingSessions = must(await sb.from("conference_sessions").select("session_code").in("session_code", codes), "read sessions");
const skipCodes = new Set(existingSessions.map((s) => s.session_code));
const [t0, t1] = [(s) => s.split(" - ")[0], (s) => s.split(" - ")[1]];

const sessions = [];
for (const code of codes.filter((c) => !skipCodes.has(c))) {
  const rows = cmeCsv.filter((r) => r.Session === code);
  const chairs = rows.filter((r) => r.Role === "Chairperson");
  const topicMap = new Map();
  for (const r of rows.filter((r) => r.Role !== "Chairperson")) {
    const key = `${r.Time}|${r.Topic}`;
    if (!topicMap.has(key)) topicMap.set(key, { title: r.Topic, start: t0(r.Time), end: t1(r.Time), seq: Number(r.Seq), people: [] });
    topicMap.get(key).people.push({ facId: r["Faculty ID"], role: r.Role });
  }
  const times = rows.map((r) => r.Time);
  sessions.push({
    code, name: rows[0]["Session Name"], date: rows[0].Date, hall: rows[0].Hall,
    start: times.map(t0).sort()[0], end: times.map(t1).sort().at(-1),
    chairs: chairs.map((c) => c["Faculty ID"]), topics: [...topicMap.values()],
  });
}

// ---- report --------------------------------------------------------
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (no writes)"}  | date ${dateOf}`);
console.log(`New faculty: ${newFaculty.length}  | already in DB: ${existing.length} (${existing.map((f) => f.faculty_id).join(", ")})`);
for (const n of newFaculty.filter((n) => n.alt_email)) console.log(`  alt_email set: ${n.canonical_name}: ${n.email} (alt ${n.alt_email})`);
for (const e of emailFixes) console.log(`  placeholder email -> real: ${e.name} (${e.faculty_id}) -> ${e.email}`);
if (skipCodes.size) console.log(`SKIPPING sessions already in DB: ${[...skipCodes].join(", ")}`);
for (const s of sessions) {
  console.log(`${s.code} ${s.name} | hall ${s.hall} ${s.start}-${s.end} | chairs ${s.chairs.length} | topics ${s.topics.length} | links ${s.topics.reduce((n, t) => n + t.people.length, 0)}`);
}
if (!APPLY) { console.log("\nDry run only. Re-run with --apply to write."); process.exit(0); }

// ---- apply (with rollback of anything inserted if a step fails) ------
const made = { faculty: [], sessions: [] };
try {
  if (newFaculty.length) {
    const rows = must(await sb.from("faculty").insert(newFaculty).select("id, faculty_id"), "insert faculty");
    made.faculty = rows.map((r) => r.id);
    rows.forEach((r) => byFacId.set(r.faculty_id, r));
  }
  for (const e of emailFixes) must(await sb.from("faculty").update({ email: e.email }).eq("id", e.id).select("id"), `update email ${e.faculty_id}`);

  for (const s of sessions) {
    const [ses] = must(await sb.from("conference_sessions").insert({
      session_code: s.code, session_name: s.name, session_date: s.date, start_time: s.start, end_time: s.end, hall: s.hall, session_type: "CME",
    }).select("id"), `insert session ${s.code}`);
    made.sessions.push(ses.id);

    if (s.chairs.length) {
      must(await sb.from("session_chairs").insert(
        s.chairs.map((fid, i) => ({ session_id: ses.id, faculty_id: byFacId.get(fid).id, sort_order: i + 1 })),
      ).select("session_id"), `insert chairs ${s.code}`);
    }
    for (const t of s.topics) {
      const [top] = must(await sb.from("session_topics").insert({
        session_id: ses.id, topic_title: t.title, start_time: t.start, end_time: t.end, sequence_no: t.seq,
      }).select("id"), `insert topic ${s.code} #${t.seq}`);
      must(await sb.from("faculty_topics").insert(
        t.people.map((p, i) => ({ faculty_id: byFacId.get(p.facId).id, topic_id: top.id, role: p.role, sort_order: i + 1 })),
      ).select("topic_id"), `insert links ${s.code} #${t.seq}`);
    }
    console.log(`  inserted ${s.code}`);
  }
  console.log("\nDone.");
} catch (err) {
  console.error(`\nFAILED: ${err.message}\nRolling back inserted rows...`);
  if (made.sessions.length) await sb.from("conference_sessions").delete().in("id", made.sessions); // cascades topics/links/chairs
  if (made.faculty.length) await sb.from("faculty").delete().in("id", made.faculty);
  console.error("Rolled back sessions and new faculty (placeholder-email updates, if any, are kept).");
  process.exit(1);
}
