-- =====================================================================
--  Integrity + performance hardening. Safe to run more than once.
--
--    psql "$DATABASE_URL" -f scripts/add_integrity_indexes.sql
--
--  1. conference_sessions.session_code is the key the Google Sheet sync
--     matches on and the code printed on every programme ("S12"), but
--     nothing prevented two sessions sharing it. Checked on 2026-11-17:
--     158 sessions, 0 duplicate codes, so the unique index applies cleanly.
--     If a future database does have duplicates the CREATE will fail —
--     find them with:
--       select session_code, count(*) from public.conference_sessions
--        group by 1 having count(*) > 1;
--
--  2. faculty_topics.topic_id is used every time a topic is expanded, and by
--     the ON DELETE CASCADE from session_topics. The primary key is
--     (faculty_id, topic_id), so it cannot serve a lookup by topic_id.
--
--  3. cme / cmefacultylist are one-off imports from the CME spreadsheet.
--     The app never reads them with the anon key, and `cme` was readable by
--     anyone holding the public anon key. They are closed to the browser
--     here; the rows are kept and the import scripts still work because they
--     connect with the service_role key (which bypasses RLS).
-- =====================================================================

-- 1. ---- one session per code -------------------------------------------------
--     Case-insensitive, to match the duplicate check in AddSessionModal
--     (`ilike` on session_code). Dropped and recreated so re-running the file
--     picks up definition changes; the rebuild is instant at this table size
--     and nothing references session_code by foreign key.
DROP INDEX IF EXISTS public.conference_sessions_session_code_key;
CREATE UNIQUE INDEX conference_sessions_session_code_key
  ON public.conference_sessions (upper(session_code));

-- 2. ---- topic_id lookups -----------------------------------------------------
CREATE INDEX IF NOT EXISTS faculty_topics_topic_id_idx
  ON public.faculty_topics (topic_id);

-- 3. ---- close the import scratch tables (data is kept) -----------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'cme') THEN
    ALTER TABLE public.cme ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.cme FROM anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'cmefacultylist') THEN
    ALTER TABLE public.cmefacultylist ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.cmefacultylist FROM anon, authenticated;
  END IF;
END $$;
