-- "Mark as reviewed (no email)" on the Emails page.
-- Run once on an existing database (Supabase Studio > SQL editor, or psql).
-- Additive and safe to re-run.
--
-- reviewed_at = the last time someone was checked by hand and no email was needed.
-- It lives on the faculty row, so a newer schedule change (pending change_log row)
-- brings the person back automatically. public = live data, demo = demo mode copy.

ALTER TABLE public.faculty
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'demo' AND table_name = 'faculty') THEN
    ALTER TABLE demo.faculty ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
