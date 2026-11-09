-- =====================================================================
--  resequence_session(p_session_id UUID)
--
--  Rebuilds sequence_no for every topic in ONE session so that:
--    - Topics are numbered 1, 2, 3, ... in start_time ascending order.
--    - Topics that share the exact same start_time get the SAME seq.
--    - Topics with NULL start_time sort AFTER every timed topic,
--      keeping their current relative order (sequence_no, then title).
--    - Co-presented topics (same start_time) share a slot but each keeps
--      its own topic_uid, so faculty links stay 1-to-1.
--
--  Safe to call any number of times. Idempotent (calling twice produces
--  the same numbering). Runs in one transaction.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.resequence_session(p_session_id UUID)
RETURNS TABLE (topic_id UUID, new_seq INTEGER) AS $$
DECLARE
  r RECORD;
  cur_seq INTEGER := 0;
  last_start TIME := NULL;
  is_first BOOLEAN := TRUE;
BEGIN
  -- Walk every topic in this session, ordered by:
  --   1) NULL start_time LAST (so unscheduled topics don't take slot 1)
  --   2) start_time ascending
  --   3) sequence_no (to keep stable order among NULLs / exact ties)
  --   4) topic_title (tiebreaker for pure determinism)
  FOR r IN
    SELECT id, start_time, sequence_no, topic_title
    FROM public.session_topics
    WHERE session_id = p_session_id
    ORDER BY
      CASE WHEN start_time IS NULL THEN 1 ELSE 0 END,
      start_time ASC NULLS LAST,
      sequence_no ASC NULLS LAST,
      topic_title ASC
  LOOP
    IF is_first THEN
      cur_seq := 1;
      last_start := r.start_time;
      is_first := FALSE;
    ELSIF r.start_time IS DISTINCT FROM last_start THEN
      -- New time group -> next number
      cur_seq := cur_seq + 1;
      last_start := r.start_time;
    END IF;
    -- If r.start_time = last_start (same time group, co-presented), keep cur_seq.

    UPDATE public.session_topics
       SET sequence_no = cur_seq
     WHERE id = r.id;

    topic_id := r.id;
    new_seq := cur_seq;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.resequence_session(UUID) TO anon, authenticated, service_role;