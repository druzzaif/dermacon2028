# Legacy import scripts (ARCHIVED)

These `.mjs` files were used **once** to seed the local Supabase
instance from the export files (`faculty_rows.csv`,
`conference_sessions_rows.csv`, `session_topics_rows.csv`,
`session_coordinators_rows.csv`, `faculty_topics_rows.csv`,
`tblsessiontopic.csv`, `topics_export.csv`).

**Do not run these again.** They are kept for reference only.

## ⚠️ Security note

Each of these files still contains a hard-coded **cloud Supabase URL**
and **publishable anon key**. They are not secrets in the
"service-role" sense, but they were never meant to be committed. If you
copy one of these files back into an active workflow, replace the hard
-coded strings with `process.env.NEXT_PUBLIC_SUPABASE_URL` /
`process.env.SUPABASE_SERVICE_ROLE_KEY`.

## What is used TODAY

- Local seed data: run `scripts/seed-local.mjs` (to be created — Task #2).
- Live app: reads/writes only through `app/supabase.ts`, which uses
  `process.env.NEXT_PUBLIC_SUPABASE_URL` (defaults to
  `http://127.0.0.1:54321` in local dev).
