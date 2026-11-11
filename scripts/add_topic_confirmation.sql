-- Per-topic confirmation. Run once (Supabase Studio > SQL editor, or psql).
-- faculty_topics has one row per (faculty, topic), so confirmation lives on that row.
ALTER TABLE faculty_topics
  ADD COLUMN IF NOT EXISTS confirmed    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
