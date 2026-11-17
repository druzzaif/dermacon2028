-- "All faculty of the session" panels. Run once (Supabase Studio > SQL editor, or psql).
-- When true, every faculty member assigned to another topic of the same session is a
-- panelist of this topic: shown as "All faculty" in the schedule, and listed as Panelist
-- (with the others named) in each person's email and PDF.
ALTER TABLE session_topics
  ADD COLUMN IF NOT EXISTS all_faculty_panel BOOLEAN NOT NULL DEFAULT false;
