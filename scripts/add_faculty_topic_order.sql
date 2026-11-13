-- Order of people on a topic (moderator first, then panelists 1, 2, 3 ...).
-- Run once on every database (local, cloud). Safe to run again.
ALTER TABLE public.faculty_topics ADD COLUMN IF NOT EXISTS sort_order INTEGER;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'demo' AND table_name = 'faculty_topics') THEN
    ALTER TABLE demo.faculty_topics ADD COLUMN IF NOT EXISTS sort_order INTEGER;
  END IF;
END $$;
