# DERMACON 2028 — Project Notes

## Runtime
- Next.js 16 App Router, React 19, Tailwind CSS 4.
- Local Supabase (Docker): run 
px supabase start in the project root.
  API listens on http://127.0.0.1:54321, Postgres on 127.0.0.1:54322.
- The app is OFFLINE-ONLY. No cloud Supabase. Every historic .mjs script
  that hard-coded a https://*.supabase.co URL now lives in scripts\legacy\
  and is archived (do not run).

## Routes
  /            app/page.tsx              redirects to /sessions
  /sessions    app/sessions/page.tsx     Master Schedule (MC then WS)
  /faculty     app/faculty/page.tsx      Faculty Directory
  /overlaps    app/overlaps/page.tsx     Faculty + Hall overlap report

## File-encoding gotcha
All PowerShell writes MUST use -Encoding UTF8.
Earlier files were written without it and contain mojibake:
  em-dash became a-circumflex-euro-tm
  checkmark became a-circumflex-oelig...
Do not copy that pattern. Every Set-Content here ends in -Encoding UTF8.

## Open issues (as of last review)
1. session_topics has rows with start_time = '00:00:00' because the old
   import scripts turned a blank CSV cell into midnight instead of NULL.
   Task #2 fixes this: run 
pm run fix:null-times after 
px supabase start.
2. sequence_no is NOT unique per session — two faculty often co-present
   one topic. Any script that matches on (session_id, sequence_no) will
   attach to the wrong topic. Match on (session_id, topic_title) instead,
   or add an explicit topic_uid column.
3. EditSessionModal still has an alert("Success") stub for Save.
4. PDF generation works in app/actions.ts (generatePDFData) but is not
   reachable from the UI yet. Add a Download button on the faculty page.

## How to start
  cd into dermacon2028-main
  npx supabase start
  npm run dev
Then open http://localhost:3000

## Housekeeping scripts
  npm run fix:null-times       run the midnight-time fixer (live)
  npm run fix:null-times:dry   show what would change, no writes

## UTF-8 BOM gotcha (learned the hard way)

Windows PowerShell 5.1's Set-Content -Encoding UTF8 **writes a BOM**
(EF BB BF) at the start of every file. Next.js's JSON parser rejects
files that start with a BOM. If package.json (or any .json) fails to
parse with "expected value at line 1 column 1", it is almost always
this.

Safe patterns to write JSON:
    # Option 1 (preferred, works in PS 5.1 and PS 7+):
    [System.IO.File]::WriteAllText(, , [System.Text.UTF8Encoding]::new(False))

    # Option 2 (PowerShell 7+ only):
    Set-Content -Path  -Value  -Encoding utf8NoBOM

NEVER do this on .json files:
    ConvertTo-Json ... | Set-Content -Encoding UTF8      # adds BOM on 5.1

To strip an existing BOM in place:
    $b = [IO.File]::ReadAllBytes($p); if ($b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { [IO.File]::WriteAllBytes($p, $b[3..($b.Length-1)]) }
## Session snapshot — 2026-11-09 19:14

### Completed
- Task #1  : cleanup (deleted app/Dashboard.tsx, moved legacy .mjs to scripts/legacy/)
- Task #2  : purged 00:00:00 times, formatTime returns null on blank
- Task #3  : page.tsx calls resequenceSession() after saves; ties sorted by topic_title
- Task #4  : real "Save & PDF" panels in Add/Edit Topic + Edit Session (PDF rendering deferred)
- Task #7  : topic_uid column + resequence_session(UUID) SQL function + npm run resequence:all
- Task #8  : npm run seed:local (dry-run) / seed:local:apply (wipe + rebuild from CSVs)
- Task #9  : faculty directory sortable + clickable phone + '0 topics' badge + session tooltip
- Task #10 : Delete-topic flow + ConfirmDeleteDialog + cascade removes faculty links
- Task #12 : print stylesheet in globals.css + Print button on /sessions

### Deferred (pick up when ready)
- Task #5  : PDF export button on /faculty  (user said "PDFs we do later")
- Task #6  : Auth + role gating
              Decision pending: (B) shared password via middleware.ts — recommended
                                (A) Supabase Auth + user_roles table
              To resume: reply with the choice + paste supabase/config.toml + app/layout.tsx

### Not started
- Task #11 : Bulk time-shift all topics in a session by +/- N minutes

### Recovery commands
    npm run dev
    npm run resequence:all       # rebuild all sequence_no from start_time
    npm run seed:local           # dry-run: show row counts, no writes
    npm run seed:local:apply     # DESTRUCTIVE: wipe local DB, reseed from CSVs

### Environment gotchas
- PowerShell 5.1 adds a BOM with 'Set-Content -Encoding UTF8'.
  ALWAYS use [IO.File]::WriteAllText(path, text, UTF8Encoding(false)) for .json
  and .tsx/.ts files. If package.json fails to parse, check for EF BB BF prefix.
- 'else' errors when pasting multi-line blocks into PS 5.1 are cosmetic —
  PS 5.1 executes if(...){...} and else{...} as separate statements on paste.
- Docker volume wipes are safe now: 'npm run seed:local:apply' rebuilds everything.