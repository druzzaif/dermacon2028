ALTER TABLE public.faculty
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'demo' AND table_name = 'faculty') THEN
    ALTER TABLE demo.faculty ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
