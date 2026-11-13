-- Chairpersons for a whole session (not tied to one topic). Many per session, in order.
-- Run once on every database (local, cloud). Safe to run again.
CREATE TABLE IF NOT EXISTS public.session_chairs (
  session_id UUID REFERENCES public.conference_sessions(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE,
  sort_order INTEGER,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, faculty_id)
);
-- (for databases that already have the table from an earlier run)
ALTER TABLE public.session_chairs ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.session_chairs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.session_chairs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.session_chairs TO anon, authenticated, service_role;

-- Demo copy (only if the demo schema exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'demo') THEN
    CREATE TABLE IF NOT EXISTS demo.session_chairs (
      session_id UUID REFERENCES demo.conference_sessions(id) ON DELETE CASCADE,
      faculty_id UUID REFERENCES demo.faculty(id) ON DELETE CASCADE,
      sort_order INTEGER,
      confirmed BOOLEAN NOT NULL DEFAULT false,
      confirmed_at TIMESTAMPTZ,
      PRIMARY KEY (session_id, faculty_id)
    );
    ALTER TABLE demo.session_chairs ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE demo.session_chairs ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
    ALTER TABLE demo.session_chairs DISABLE ROW LEVEL SECURITY;
    GRANT ALL ON demo.session_chairs TO anon, authenticated, service_role;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
