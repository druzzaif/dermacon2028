# Dermacon 2028 — programme & faculty manager

Next.js 16 (App Router) app for the Dermacon 2028 scientific programme: sessions,
topics, faculty, chairpersons, coordinators, printable session sheets and reports,
Excel/PDF exports, and a faculty venue map. Data lives in Supabase (Postgres);
the Google Sheet stays the master copy and is pushed in through the sync.

## Requirements

- Node.js 20.9 or newer (the build is tested on the Node version in this repo's CI/docker image)
- Docker Desktop — only if you want the local Supabase stack
- `psql` — only for the one-off database bootstrap

## 1. Install

```bash
npm install
```

## 2. Environment

```bash
cp .env.example .env.local
```

Fill in the values from `npx supabase status` (local) or **Project settings → API**
(hosted). `.env.example` documents each variable; the important ones:

| Variable | Needed by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app, browser (through the `/sb` rewrite) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app, browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side scripts only — never in a `"use client"` file |
| `DATABASE_URL` | `scripts/setup-demo-schema.mjs`, `psql` bootstrap |
| `SYNC_TOKEN` | optional shared secret with the Apps Script web app |

## 3. Database

`scripts/schema.sql` is the authoritative DDL: 7 tables, the
`faculty_topic_counts` view, 10 functions (including the `change_log` triggers),
triggers, indexes and the `anon` / `authenticated` / `service_role` grants.

**New, empty database** (local Docker or a fresh hosted project):

```bash
psql "$DATABASE_URL" -f scripts/schema.sql
```

It contains no `DROP` statements, so run it once on an empty database only.

**Existing database** — apply the additive hardening (unique session code,
`faculty_topics.topic_id` index, import tables closed to the browser). Re-runnable:

```bash
psql "$DATABASE_URL" -f scripts/add_integrity_indexes.sql
```

After any structural change, regenerate the snapshot so the file stays true:

```bash
docker exec supabase_db_dermacon2028 pg_dump -U postgres -d postgres \
  --schema-only --schema=public --no-owner --no-comments \
  --exclude-table=public.cme --exclude-table=public.cmefacultylist > /tmp/dump.sql
```

then drop the `\restrict` / `CREATE SCHEMA` / `ALTER DEFAULT PRIVILEGES` lines
(Supabase-platform owned, not part of the app schema) and keep the header block
at the top of the existing `scripts/schema.sql`.

The old root-level `create_tables.sql` is the hand-written first draft and is
**not** enough on its own — it has no `change_log` triggers.

## 4. Run

```bash
npm run dev     # dev server + opens the browser
npm run build   # production build
npm start       # serve the production build
npm run check   # tsc --noEmit — the gate that must stay clean
npm run lint    # ESLint (see below)
```

`npm run lint` still reports a pre-existing backlog, dominated by
`@typescript-eslint/no-explicit-any` on Supabase row objects, so it is not a
gate yet. Fix those file by file as you touch them; `npm run check` is what
should stay green.

## 5. Google Sheet sync

`google-script/Code.js` is the Apps Script web app that talks to the sheet. It is
deployed separately from the Next.js app: after editing `google-script/Code.js` or
`google-script/Template.html`, create and deploy a **new version** of the web app,
otherwise live faculty emails keep using the old template and pacing.

If you set `SYNC_TOKEN` in `.env.local`, set the same value in the Apps Script
**Project settings → Script properties**, otherwise every call from the app is
rejected.

## 6. Seed / demo data

```bash
npm run seed:local:apply        # dummy dataset into public
npm run seed:local:original     # replay the original import, dry run first
npm run demo:setup              # create the `demo` schema
npm run demo:reset              # reseed `demo` (app serves it when demo mode is on)
npm run resequence:all          # renumber session topics
npm run fix:null-times          # backfill missing start/end times
```

## Faculty venue routes

The faculty venue map is available at `/venue` and can be shared directly with attendees.

### Deploying on Vercel

1. Sign in to Vercel and deploy this folder with `npx vercel`, or import the repository if it has been pushed to GitHub. Complete the prompts and use the production deployment when ready.
2. Vercel assigns an HTTPS address ending in `.vercel.app`; a custom domain is optional.
3. Add the app's required environment variables in the Vercel project settings.
4. Redeploy after adding or changing a variable: use **Deployments → Redeploy**, push a commit when using Git integration, or run `npx vercel --prod` from this folder.

## Security note

There is no authentication in front of the app, and the browser uses the `anon`
key with full table grants (no row-level security on `public`). Treat the URL as
the only secret: anyone who has it can edit the programme. If the app is ever put
on a public domain, add an auth gate (`app/proxy.ts` in Next 16, formerly
`middleware.ts`) and RLS policies before telling people about it.

