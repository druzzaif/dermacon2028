// scripts/import-programme-topics.mjs
// ADDITIVE import of topics, speakers, moderators, panelists and chairpersons for the
// 5-7 Feb 2027 scientific programme (from the organiser's pasted sheets).
//
//   node scripts/import-programme-topics.mjs            # dry run, no writes
//   node scripts/import-programme-topics.mjs --apply    # write to the database
//
// Rules (nothing is guessed):
//   * Only values stated in the sheet are imported. Blank stays blank.
//   * Rows with no person name, or no topic, are skipped (listed in SKIPPED below / the report).
//   * People are matched to existing faculty by e-mail (primary or alt), then by exact name.
//     Name look-alikes are only REPORTED; set them in MATCH_OVERRIDE after you confirm.
//   * Chairpersons -> session_chairs. Panelists are stored with role "Panel" (the app's value).
//   * Existing sessions are only touched where listed in SESSION_UPDATES, and only if the
//     current value is exactly what we expect.
//   * Style: "Dr Name" (no full stop), e-mails lower-case, "(Dermatophytosis)" tags and
//     "(35 min)" durations removed from topic titles (the time columns hold that).

import fs from "node:fs";
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
const must = (r, label) => { if (r.error) throw new Error(`${label}: ${r.error.message}`); return r.data; };

// ---- people (key -> details exactly as in the sheet, normalised for style) ----------
const P = (name, email = null, extra = {}) => ({ name, email, ...extra });
const PEOPLE = {
  bunker: P("Dr Christopher Bunker", "cbbunker@me.com", { intl: true }),
  mysore: P("Dr Venkataram Mysore", "mnvenkataram@gmail.com"),
  lalit: P("Dr Lalit Gupta", "lalitanj@yahoo.com"),
  shital: P("Dr Shital Poojary", "spoojary2004@gmail.com"),
  krina: P("Dr Krina Patel", "drkbpatel66@gmail.com"),
  yen: P("Yen Loo Lim", null, { intl: true }),
  arti_sarda: P("Dr Arti Sarda", "draartisarda@yahoo.co.in"),
  nutan: P("Dr Nutan Gowda", "nutan.gowda@umassmemorial.org", { intl: true }),
  galadari: P("Dr Hassan Galadari", "hgaladari@gmail.com", { intl: true }),
  suresh: P("Dr Suresh Joshipura"),
  razzaque: P("Dr Razzaque Ahmed", "arahmedmd@msn.com", { intl: true }),
  raghvendra: P("Dr Raghvendra Rao", "raghavrao1@gmail.com"),
  maglie: P("Dr Roberto Maglie", "roberto.maglie@unifi.it", { intl: true }),
  dipanker: P("Dr Dipanker De", "dr_dipankar_de@yahoo.in"),
  sujay: P("Dr Sujay Khandpur", "sujay_khandpur@yahoo.com"),
  vishalakshi: P("Dr Vishalakshi Vishwanath", "visha1967@gmail.com"),
  criton: P("Prof S Criton", "criton@thecriton.com"),
  sudip: P("Dr Sudip Ghosh", "dr_skghosh@yahoo.co.in"),
  rawal: P("Dr Ranjan Rawal", "ranjancraval@gmail.com"),
  lim: P("Dr Henry Lim", "hlim1@hfhs.org", { intl: true }),
  manas: P("Dr Manas Chatterjee", "drmanaschatterjee@gmail.com"),
  pankaj: P("Dr Pankaj Tiwary", "drpkt97@gmail.com"),
  dhwani: P("Dr Dhwani Shah", "drdhwani21@gmail.com"),
  vinay: P("Dr Vinay Singh", "drvinay522@yahoo.com"),
  tegveer: P("Dr Tegveer Singh", "tegveersingh@gmail.com"),
  polina: P("Dr Polina Pyatilova", "polina.pyatilova@charite.de", { intl: true }),
  godse: P("Dr Kiran Godse", "drgodse@gmail.com"),
  malvika: P("Dr Malvika Kohli"),
  jana: P("Dr Sukumar Jana"),
  vkjain: P("Dr V K Jain"),
  sudesh: P("Dr Sudesh Choudhary"),
  maitrayee: P("Dr Maitrayee Panda", "pandamaitreyee@gmail.com"),
  chetna: P("Dr Chetna Desai", "drdesaichetna@gmail.com"),
  sahana: P("Dr Sahana Srihari", "drsahanasrihari@gmail.com"),
  vivasvat: P("Dr Vivasvat Bakaya", "vivasvatbakaya@gmail.com"),
  thappa: P("Dr D M Thappa", "dmthappa@gmail.com"),
  mary: P("Dr Mary Vineetha", "drmaryvineetha@gmail.com"),
  rashmikant: P("Dr Rashmikant Shah"),
  arghya: P("Dr Arghyaprasun Ghosh"),
  samir: P("Dr Samir Shah"),
  manjunath: P("Dr Manjunath Shenoy", "manjunath576117@yahoo.co.in"),
  zawar: P("Dr Vijay Zawar", "drvijayzawar@rediffmail.com"),
  rameshbhat: P("Dr Ramesh Bhat", "rameshderma@gmail.com"),
  madhu: P("Dr Madhu Rengarajan", "renmadhu08@gmail.com"),
  saritha: P("Dr Saritha Mohanan", "saritha_mohanan@yahoo.co.in"),
  nayan: P("Dr Nayan Patel", "patelnayan78np@gmai.com"),
  sirka: P("Dr C S Sirka", "dermat_chandra@aiimsbhubaneswar.edu.in", { alt: "cssirka2006@gmail.com" }),
  ashwini: P("Dr Ashwini P K", "drashwinipk@gmail.com", { alt: "ashwinipk@jssuni.edu.in" }),
  satya: P("Dr Satyadarshi Patnaik"),
  arti_shah: P("Dr Arti Shah"),
  rashmi: P("Dr Rashmi Sarkar", "rashmisarkar@gmail.com"),
  seemal: P("Dr Seemal Desai", "seemald@yahoo.com"),
  anupam: P("Dr Anupam Das", "anupamdasdr@gmail.com"),
  shyamanta: P("Dr Shyamanta Barua", "drshyamanta@gmail.com"),
  nilay: P("Dr Nilay Kanti Das", "drdasnilay@gmail.com"),
  jayakar: P("Dr Jayakar Thomas"),
  husain: P("Dr Husain Juma"),
  aditi: P("Dr Aditi Mishra"),
  sandipan: P("Dr Sandipan Dhar", "doctorsandipan@gmail.com"),
  abir: P("Dr Abir Sarswat", "abirsaraswat@yahoo.com"),
};

// After you confirm a look-alike in the dry-run report, map  person key -> existing faculty_id.
const MATCH_OVERRIDE = {
  // Confirmed by the organiser as the same person (existing spelling kept):
  malvika: "FAC232",   // Dr Malavika Kohli
  sudesh: "FAC102",    // Dr Sudesh Chaudhari
  rawal: "FAC159",     // Dr Ranjan Raval
  arti_shah: "FAC303", // Dr Aarti Shah
};

// ---- programme (session_code -> chairs + topics) -----------------------------------
// roles: F = Faculty, M = Moderator, P = Panel (panelist)
const F = (k) => [k, "Faculty"], M = (k) => [k, "Moderator"], Pn = (k) => [k, "Panel"];
const PROGRAMME = {
  "SP7-02": {
    chairs: [],
    topics: [
      { t: "Update on SCAR", s: "09:30", e: "09:50", who: [F("bunker")] },
      { t: "CDSCO Guidelines and Dermatologic Drugs", s: "09:50", e: "10:05", who: [F("mysore")] },
      { t: "Beyond the Usual: Unusual Drug Reactions in Dermatology", s: "10:20", e: "11:00",
        who: [M("lalit"), Pn("shital"), Pn("krina"), Pn("yen"), Pn("arti_sarda"), Pn("nutan")] },
    ],
  },
  "SP7-03": {
    chairs: [],
    topics: [{ t: "Soft Tissue Augmentation – Match an Art with Science", s: null, e: null, who: [F("galadari")] }],
  },
  "SP6-01": {
    chairs: ["suresh"],
    topics: [
      { t: "Update in Pemphigus", s: "09:30", e: "09:50", who: [F("razzaque")] },
      { t: "Subepidermal Blistering Disorders – What's New", s: "09:50", e: "10:05", who: [F("raghvendra")] },
      { t: "Personalized Medicine in AIVBD", s: "10:05", e: "10:25", who: [F("maglie")] },
      { t: "Panel Discussion: Refractory VBD – Difficult-to-Treat Cases from Practice", s: "10:25", e: "11:00",
        who: [M("dipanker"), Pn("sujay"), Pn("vishalakshi"), Pn("criton"), Pn("sudip"), Pn("rawal")] },
    ],
  },
  "SP6-38": { chairs: [], topics: [{ t: "Update on Treatment of Vitiligo", s: "11:00", e: "11:20", who: [F("lim")] }] },
  "SP6-02": {
    chairs: [],
    topics: [
      { t: "Biologics in Dermatology – Evidence, Experience and Emerging Frontiers", s: "14:30", e: "15:00",
        who: [M("manas"), Pn("pankaj"), Pn("dhwani"), Pn("vinay"), Pn("tegveer")] },
    ],
  },
  "SP6-03": {
    chairs: [],
    topics: [
      { t: "Mast Cell Activation Disorders", s: "15:00", e: "15:20", who: [F("polina")] },
      { t: "Update on Urticaria Guidelines", s: "15:20", e: "15:35", who: [F("godse")] },
    ],
  },
  "SP6-04": {
    chairs: [],
    topics: [{ t: "Skin Activation: A Novel Approach to Advancing Skin Longevity", s: "16:20", e: "16:40", who: [F("malvika")] }],
  },
  "SP5-01": {
    chairs: ["jana", "vkjain", "sudesh"],
    topics: [
      { t: "Fever with Rash in Paediatric Patients", s: "09:00", e: "09:15", who: [F("maitrayee")] },
      { t: "Antimicrobial Stewardship for Dermatologist: What to Know", s: "09:15", e: "09:30", who: [F("chetna")] },
      { t: "Case-Based Discussion on Difficult to Diagnose and Difficult to Treat Cutaneous Infections", s: "09:30", e: "10:00",
        who: [M("sahana"), Pn("vivasvat"), Pn("thappa"), Pn("mary")] },
    ],
  },
  "SP5-02": {
    chairs: ["rashmikant", "arghya", "samir"],
    topics: [
      { t: "Dermatophytoses: Understanding the Global Epidemiological Shift", s: "10:00", e: "10:15", who: [F("manjunath")] },
      { t: "Onychomycin mx", s: "10:15", e: "10:30", who: [F("zawar")] },
      { t: "Dermatophytoses Severity Score – Concepts and Implementation", s: "10:30", e: "10:45", who: [F("rameshbhat")] },
      { t: "Recalcitrant Dermatophytosis: Resistant, Relapsing or Recurrent? – Panel Discussion", s: "10:45", e: "11:15",
        who: [M("madhu"), Pn("saritha"), Pn("nayan"), Pn("sirka"), Pn("ashwini")] },
    ],
  },
  "SP5-03": {
    chairs: ["satya", "arti_shah"],
    topics: [
      { t: "Facial Hyperpigmentation – What's New in Management?", s: "14:00", e: "14:15", who: [F("rashmi")] },
      { t: "Innovations in Hyperpigmentation", s: "14:15", e: "14:30", who: [F("seemal")] },
      { t: "Melasma – How Experts Manage", s: "14:30", e: "15:00",
        who: [M("anupam"), Pn("seemal"), Pn("rashmi"), Pn("shyamanta"), Pn("nilay")] },
    ],
  },
  "SP5-04": {
    chairs: ["jayakar", "husain", "aditi"],
    topics: [
      { t: "Treat-to-Target Therapies", s: "15:00", e: "15:15", who: [F("sandipan")] },
      { t: "Case-Based Management of Atopic Dermatitis across the Lifespan", s: "15:30", e: "16:00", who: [M("abir"), Pn("sandipan")] },
    ],
  },
};

// Only changes the sheet states clearly. `from` must match the database now, else it is skipped.
const SESSION_UPDATES = [
  { code: "SP6-01", set: { session_name: "Autoimmune Vesiculobullous Disorders (AIVBD) - From Pathogenesis to Precision Medicines" },
    from: { session_name: "AIVBD - From Pathogenesis to Precision" } },
  { code: "SP6-03", set: { end_time: "16:20:00" }, from: { start_time: "15:00:00", end_time: "16:00:00" } },
  { code: "SP6-04", set: { start_time: "16:00:00", end_time: "17:00:00" }, from: { start_time: null, end_time: null } },
  { code: "SP6-39", set: { end_time: "11:55:00" }, from: { start_time: "11:25:00", end_time: "12:00:00" } },
];

// ---- plan ----------------------------------------------------------------------------
const keysUsed = new Set();
for (const p of Object.values(PROGRAMME)) {
  p.chairs.forEach((k) => keysUsed.add(k));
  p.topics.forEach((t) => t.who.forEach(([k]) => keysUsed.add(k)));
}
for (const k of keysUsed) if (!PEOPLE[k]) throw new Error(`Unknown person key ${k}`);
const unused = Object.keys(PEOPLE).filter((k) => !keysUsed.has(k));
if (unused.length) throw new Error(`People defined but not used: ${unused.join(", ")}`);

const allFaculty = must(await sb.from("faculty").select("id, faculty_id, canonical_name, email, alt_email").limit(5000), "read faculty");
const isPlaceholder = (e) => !e || /@placeholder\.com$/i.test(e);
const norm = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\b(dr|prof|brig)\b/g, " ").replace(/\s+/g, " ").trim();
const lc = (s) => (s || "").toLowerCase();

const resolved = {}; // key -> { existing: row } | { create: person }
const lookalikes = [];
for (const k of keysUsed) {
  const p = PEOPLE[k];
  let hit = MATCH_OVERRIDE[k] ? allFaculty.find((f) => f.faculty_id === MATCH_OVERRIDE[k]) : null;
  if (!hit) hit = allFaculty.find((f) => [p.email, p.alt].filter(Boolean).some((e) => [lc(f.email), lc(f.alt_email)].includes(lc(e))));
  if (!hit) hit = allFaculty.find((f) => norm(f.canonical_name) === norm(p.name));
  if (hit) { resolved[k] = { existing: hit }; continue; }
  resolved[k] = { create: p };
  const parts = norm(p.name).split(" ");
  const last = parts.at(-1), first = parts[0];
  const near = allFaculty.filter((f) => {
    const n = norm(f.canonical_name).split(" ");
    return n.includes(last) || (n.at(-1)?.[0] === last[0] && n[0] === first) || n.join("") === parts.join("");
  });
  if (near.length) lookalikes.push({ key: k, name: p.name, near });
}

// next faculty ids
const maxNum = Math.max(...allFaculty.map((f) => Number((f.faculty_id || "").replace(/\D/g, "")) || 0));
let nextNum = maxNum;
const newFaculty = [];
for (const k of keysUsed) {
  if (!resolved[k].create) continue;
  const p = resolved[k].create;
  const parts = p.name.split(/\s+/);
  const row = {
    faculty_id: `FAC${String(++nextNum).padStart(3, "0")}`,
    canonical_name: p.name,
    first_name: parts.length > 1 ? parts.slice(0, -1).join(" ") : p.name,
    last_name: parts.length > 1 ? parts.at(-1) : null,
    email: p.email,
    alt_email: p.alt || null,
    country: p.intl ? "INTL" : null,
    person_type: "Faculty",
    is_faculty: true,
    is_coordinator: false,
    is_active: true,
  };
  newFaculty.push({ key: k, row });
}
const emailFixes = [];
for (const k of keysUsed) {
  const r = resolved[k];
  if (r.existing && isPlaceholder(r.existing.email) && PEOPLE[k].email) emailFixes.push({ id: r.existing.id, name: r.existing.canonical_name, email: PEOPLE[k].email });
}

const codes = Object.keys(PROGRAMME);
const sessions = must(await sb.from("conference_sessions").select("*").in("session_code", [...codes, ...SESSION_UPDATES.map((u) => u.code)]), "read sessions");
const byCode = new Map(sessions.map((s) => [s.session_code, s]));
for (const c of codes) if (!byCode.has(c)) throw new Error(`Session ${c} not found in database`);
const existingTopics = must(await sb.from("session_topics").select("session_id, topic_title").in("session_id", codes.map((c) => byCode.get(c).id)), "read topics");
const existingChairs = must(await sb.from("session_chairs").select("session_id, faculty_id").in("session_id", codes.map((c) => byCode.get(c).id)), "read chairs");

const updates = [];
const updateNotes = [];
for (const u of SESSION_UPDATES) {
  const s = byCode.get(u.code);
  if (!s) { updateNotes.push(`${u.code}: session not found, no update`); continue; }
  const same = Object.entries(u.from).every(([k, v]) => (s[k] ?? null) === v);
  if (same) updates.push({ id: s.id, code: u.code, set: u.set, from: u.from });
  else updateNotes.push(`${u.code}: database no longer matches the expected old values, NOT changed`);
}

// ---- report --------------------------------------------------------------------------
console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN (no writes)"}`);
const nExisting = Object.values(resolved).filter((r) => r.existing).length;
console.log(`People: ${keysUsed.size} | matched to existing: ${nExisting} | new faculty: ${newFaculty.length}`);
for (const k of keysUsed) if (resolved[k].existing) console.log(`  = ${PEOPLE[k].name}  ->  ${resolved[k].existing.faculty_id} ${resolved[k].existing.canonical_name}`);
for (const n of newFaculty) console.log(`  + ${n.row.faculty_id} ${n.row.canonical_name} | ${n.row.email ?? "(no email)"}${n.row.alt_email ? ` (alt ${n.row.alt_email})` : ""}${n.row.country ? ` | ${n.row.country}` : ""}`);
if (lookalikes.length) {
  console.log("\nLOOK-ALIKES (not merged; confirm and set MATCH_OVERRIDE, else a NEW faculty is created):");
  for (const l of lookalikes) console.log(`  ${l.name}: ${l.near.map((f) => `${f.faculty_id} ${f.canonical_name} <${f.email ?? ""}>`).join(" | ")}`);
}
for (const e of emailFixes) console.log(`  placeholder email -> real: ${e.name} -> ${e.email}`);
console.log("\nSession updates:");
for (const u of updates) console.log(`  ${u.code}: ${JSON.stringify(u.from)} -> ${JSON.stringify(u.set)}`);
for (const n of updateNotes) console.log(`  ${n}`);
console.log("\nPer session:");
const plan = [];
for (const code of codes) {
  const s = byCode.get(code);
  const have = new Set(existingTopics.filter((t) => t.session_id === s.id).map((t) => t.topic_title));
  const haveChairs = new Set(existingChairs.filter((c) => c.session_id === s.id).map((c) => c.faculty_id));
  const topics = PROGRAMME[code].topics.map((t, i) => ({ ...t, seq: i + 1 })).filter((t) => !have.has(t.t));
  plan.push({ s, chairs: PROGRAMME[code].chairs, haveChairs, topics });
  console.log(`  ${code} ${s.session_name}: chairs ${PROGRAMME[code].chairs.length} | topics ${topics.length} (${PROGRAMME[code].topics.length - topics.length} already there) | links ${topics.reduce((n, t) => n + t.who.length, 0)}`);
  for (const t of topics) console.log(`      #${t.seq} ${t.s ?? "--"}-${t.e ?? "--"} ${t.t}: ${t.who.map(([k, r]) => `${PEOPLE[k].name} [${r}]`).join(", ")}`);
}
if (!APPLY) { console.log("\nDry run only. Re-run with --apply to write."); process.exit(0); }

// ---- apply (rolls back what it inserted if a step fails) -------------------------------
const made = { faculty: [], topics: [], chairs: [] };
const oldSession = [];
try {
  if (newFaculty.length) {
    const rows = must(await sb.from("faculty").insert(newFaculty.map((n) => n.row)).select("id, faculty_id"), "insert faculty");
    made.faculty = rows.map((r) => r.id);
    for (const n of newFaculty) resolved[n.key] = { existing: rows.find((r) => r.faculty_id === n.row.faculty_id) };
  }
  for (const e of emailFixes) must(await sb.from("faculty").update({ email: e.email }).eq("id", e.id).select("id"), `update email ${e.name}`);
  for (const u of updates) {
    oldSession.push({ id: u.id, set: u.from });
    must(await sb.from("conference_sessions").update(u.set).eq("id", u.id).select("id"), `update session ${u.code}`);
  }
  for (const p of plan) {
    const rows = p.chairs.filter((k) => !p.haveChairs.has(resolved[k].existing.id))
      .map((k, i) => ({ session_id: p.s.id, faculty_id: resolved[k].existing.id, sort_order: i + 1 }));
    if (rows.length) { must(await sb.from("session_chairs").insert(rows).select("session_id"), `chairs ${p.s.session_code}`); made.chairs.push(...rows); }
    for (const t of p.topics) {
      const [top] = must(await sb.from("session_topics").insert({
        session_id: p.s.id, topic_title: t.t, start_time: t.s ? `${t.s}:00` : null, end_time: t.e ? `${t.e}:00` : null, sequence_no: t.seq,
      }).select("id"), `topic ${p.s.session_code} #${t.seq}`);
      made.topics.push(top.id);
      must(await sb.from("faculty_topics").insert(
        t.who.map(([k, role], i) => ({ faculty_id: resolved[k].existing.id, topic_id: top.id, role, sort_order: i + 1 })),
      ).select("topic_id"), `links ${p.s.session_code} #${t.seq}`);
    }
    console.log(`  done ${p.s.session_code}`);
  }
  console.log("\nDone.");
} catch (err) {
  console.error(`\nFAILED: ${err.message}\nRolling back...`);
  if (made.topics.length) await sb.from("session_topics").delete().in("id", made.topics); // cascades links
  for (const c of made.chairs) await sb.from("session_chairs").delete().eq("session_id", c.session_id).eq("faculty_id", c.faculty_id);
  for (const o of oldSession) await sb.from("conference_sessions").update(o.set).eq("id", o.id);
  if (made.faculty.length) await sb.from("faculty").delete().in("id", made.faculty);
  console.error("Rolled back (placeholder-email updates, if any, are kept).");
  process.exit(1);
}
