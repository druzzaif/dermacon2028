# HANDOFF - DERMACON 2028 programme app

Verified state, 2026-11-17. Use this file (not an old chat transcript) to
start a fresh conversation.

## Stack / runtime
- Next.js 16.4.5 (App Router), React 19, Tailwind 4, TypeScript.
- Local Supabase only (offline). `npx supabase start`; API :54321, DB :54322.
- DB container: `supabase_db_dermacon2028`, queried with
  `docker exec supabase_db_dermacon2028 psql -U postgres -d postgres -Atc "..."`.
- Branch: `ui-redesign` (HEAD 3fab0f9, tracking origin/ui-redesign).

## Verified green
- `npm run check` (tsc --noEmit) exits 0.
- Live tables: change_log, cme, cmefacultylist, conference_sessions, faculty,
  faculty_topic_counts, faculty_topics, session_chairs, session_coordinators,
  session_topics. There is no `public.sessions` table.
- Row counts: faculty 369, conference_sessions 158, session_topics 502,
  faculty_topics 539, session_chairs 26, session_coordinators 169,
  change_log 672.
- `scripts/schema.sql` is the authoritative bootstrap (7 core tables,
  faculty_topic_counts view, functions, triggers, indexes, grants); keep it in
  sync after any DDL. `scripts/add_integrity_indexes.sql` is applied live.
  Root `create_tables.sql` is an obsolete draft - do not use.
- change_log rows come from Postgres triggers (cl_ft_*, cl_topic_*,
  cl_session_*); app/actions.ts only logs manual events (sync, faculty add/remove).

## Uncommitted working tree
33 modified, 48 deleted, 15 untracked (large pre-existing refactor).
Untracked highlights: `app/lib/topicChoices.ts`, `app/lib/whatsapp.ts`,
`app/components/{GroupChoiceDialog,PdfOptionsDialog,TopicPicker,
SendWhatsAppDialog,FacultyListPrintDialog}.tsx`, `scripts/schema.sql`,
`scripts/add_integrity_indexes.sql`, `venuemap/`, `whatsapp/`.

## Open items
1. 5 faculty rows still have NULL/empty `faculty_id` (sync de-dup risk):
   one "Demofaculty" test row plus four real faculty. Decide: backfill IDs or
   exclude the demo row.
2. Commit the current refactor in reviewed chunks (schema + scripts first).
3. Known gaps: no auth (browser uses anon key with full grants, no RLS);
   `app/actions.ts` is ~1200 lines; ESLint baseline ~354 errors (mostly
   `no-explicit-any` on Supabase rows) so lint is not a gate.
4. Optional: Vitest for `app/lib/{slots,sessionOverlap,time,exportData}`;
   PDFs written to `os.tmpdir()` instead of `public/`.

## Ground rules
- Ask before writing to public data.
- Verify with `npm run check`, `npm run build`, and a psql query - don't assume.
- PowerShell writes must be UTF-8 without BOM
  (`[System.IO.File]::WriteAllText($p,$s,[System.Text.UTF8Encoding]::new($false))`).
- Conference data (emails/phones) must not land in git or in summaries.
