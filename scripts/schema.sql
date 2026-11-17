-- =====================================================================
--  DERMACON 2028 - public schema snapshot
--
--  Authoritative DDL for everything the app touches: 7 tables, the
--  faculty_topic_counts view, 10 functions (including the change-log
--  triggers) and their triggers/indexes/grants.
--
--  Generated from the live local Supabase database on 2026-11-17 with:
--    docker exec supabase_db_dermacon2028 pg_dump -U postgres -d postgres \
--      --schema-only --schema=public --no-owner --no-comments \
--      --exclude-table=public.cme --exclude-table=public.cmefacultylist
--
--  The two excluded tables (cme, cmefacultylist) are scratch imports from
--  the CME spreadsheet. They are not used by the app; re-import with
--  scripts/import-cme.mjs if you ever need them again.
--
--  Apply to a fresh database:  psql "$DATABASE_URL" -f scripts/schema.sql
--  (Safe on an existing database only if it is empty; there are no DROP
--  statements, so re-running will fail on the first existing object.)
--
--  For an existing database, use the additive scripts instead:
--    psql "$DATABASE_URL" -f scripts/add_integrity_indexes.sql
--
--  Re-generate this file after any structural change (see README).
-- =====================================================================


--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: cl_ft_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_ft_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE tt TEXT; sc TEXT; fn TEXT; gone BOOLEAN;
BEGIN
  -- When a whole topic is deleted, cl_topic_delete logs it; skip the cascade rows
  SELECT NOT EXISTS (SELECT 1 FROM session_topics WHERE id = OLD.topic_id) INTO gone;
  IF gone THEN RETURN OLD; END IF;
  SELECT st.topic_title, cs.session_code INTO tt, sc
    FROM session_topics st LEFT JOIN conference_sessions cs ON cs.id = st.session_id WHERE st.id = OLD.topic_id;
  SELECT canonical_name INTO fn FROM faculty WHERE id = OLD.faculty_id;
  INSERT INTO change_log (event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
  VALUES (CASE WHEN OLD.role = 'Chairperson' THEN 'chair_removed' ELSE 'faculty_removed' END,
          OLD.faculty_id, fn, OLD.topic_id, tt, sc, COALESCE(OLD.role, 'Faculty'), true);
  RETURN OLD;
END $$;


--
-- Name: cl_ft_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_ft_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE tt TEXT; ts TIME; te TIME; sc TEXT; fn TEXT;
BEGIN
  SELECT st.topic_title, st.start_time, st.end_time, cs.session_code INTO tt, ts, te, sc
    FROM session_topics st LEFT JOIN conference_sessions cs ON cs.id = st.session_id WHERE st.id = NEW.topic_id;
  SELECT canonical_name INTO fn FROM faculty WHERE id = NEW.faculty_id;
  INSERT INTO change_log (event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
  VALUES (CASE WHEN NEW.role = 'Chairperson' THEN 'chair_added' ELSE 'faculty_assigned' END,
          NEW.faculty_id, fn, NEW.topic_id, tt, sc,
          COALESCE(NEW.role, 'Faculty') || ' Â· ' || cl_t(ts) || ' â€“ ' || cl_t(te), true);
  RETURN NEW;
END $$;


--
-- Name: cl_ft_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_ft_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE tt TEXT; sc TEXT; fn TEXT;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR (NEW.confirmed AND NOT OLD.confirmed) THEN
    SELECT st.topic_title, cs.session_code INTO tt, sc
      FROM session_topics st LEFT JOIN conference_sessions cs ON cs.id = st.session_id WHERE st.id = NEW.topic_id;
    SELECT canonical_name INTO fn FROM faculty WHERE id = NEW.faculty_id;
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO change_log (event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
      VALUES (CASE WHEN NEW.role = 'Chairperson' THEN 'chair_added'
                   WHEN OLD.role = 'Chairperson' THEN 'chair_removed' ELSE 'role_changed' END,
              NEW.faculty_id, fn, NEW.topic_id, tt, sc,
              COALESCE(OLD.role, 'Faculty') || ' â†’ ' || COALESCE(NEW.role, 'Faculty'), true);
    END IF;
    IF NEW.confirmed AND NOT OLD.confirmed THEN
      INSERT INTO change_log (created_at, event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
      VALUES (COALESCE(NEW.confirmed_at, now()), 'confirmed', NEW.faculty_id, fn, NEW.topic_id, tt, sc,
              COALESCE(NEW.role, 'Faculty'), false);
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: cl_session_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_session_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO change_log (event_type, session_code, detail, notify)
  VALUES ('session_added', NEW.session_code, NEW.session_name, false);
  RETURN NEW;
END $$;


--
-- Name: cl_session_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_session_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE d TEXT := ''; r RECORD;
BEGIN
  IF OLD.session_name IS DISTINCT FROM NEW.session_name
     OR OLD.session_date IS DISTINCT FROM NEW.session_date
     OR OLD.hall IS DISTINCT FROM NEW.hall
     OR OLD.start_time IS DISTINCT FROM NEW.start_time
     OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    IF OLD.session_name IS DISTINCT FROM NEW.session_name THEN d := d || 'Name: ' || COALESCE(OLD.session_name, '') || ' â†’ ' || COALESCE(NEW.session_name, '') || '. '; END IF;
    IF OLD.session_date IS DISTINCT FROM NEW.session_date THEN d := d || 'Date: ' || COALESCE(to_char(OLD.session_date, 'DD Mon YYYY'), '--') || ' â†’ ' || COALESCE(to_char(NEW.session_date, 'DD Mon YYYY'), '--') || '. '; END IF;
    IF OLD.hall IS DISTINCT FROM NEW.hall THEN d := d || 'Hall: ' || COALESCE(OLD.hall, '--') || ' â†’ ' || COALESCE(NEW.hall, '--') || '. '; END IF;
    IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
      d := d || 'Session time: ' || cl_t(OLD.start_time) || ' â€“ ' || cl_t(OLD.end_time) || ' â†’ ' || cl_t(NEW.start_time) || ' â€“ ' || cl_t(NEW.end_time) || '. ';
    END IF;
    INSERT INTO change_log (event_type, session_code, detail, notify) VALUES ('session_edited', NEW.session_code, trim(d), false);
    FOR r IN SELECT DISTINCT ft.faculty_id, f.canonical_name
             FROM session_topics st JOIN faculty_topics ft ON ft.topic_id = st.id JOIN faculty f ON f.id = ft.faculty_id
             WHERE st.session_id = NEW.id LOOP
      INSERT INTO change_log (event_type, faculty_id, faculty_name, session_code, detail, notify)
      VALUES ('session_edited', r.faculty_id, r.canonical_name, NEW.session_code, trim(d), true);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: cl_t(time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_t(t time without time zone) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE WHEN t IS NULL THEN '--' ELSE to_char(t, 'FMHH12:MI AM') END
$$;


--
-- Name: cl_topic_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_topic_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sc TEXT; r RECORD;
BEGIN
  SELECT session_code INTO sc FROM conference_sessions WHERE id = OLD.session_id;
  INSERT INTO change_log (event_type, topic_id, topic_title, session_code, detail, notify)
  VALUES ('topic_removed', OLD.id, OLD.topic_title, sc, cl_t(OLD.start_time) || ' â€“ ' || cl_t(OLD.end_time), false);
  FOR r IN SELECT ft.faculty_id, f.canonical_name, ft.role FROM faculty_topics ft JOIN faculty f ON f.id = ft.faculty_id WHERE ft.topic_id = OLD.id LOOP
    INSERT INTO change_log (event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
    VALUES ('topic_removed', r.faculty_id, r.canonical_name, OLD.id, OLD.topic_title, sc, COALESCE(r.role, 'Faculty'), true);
  END LOOP;
  RETURN OLD;
END $$;


--
-- Name: cl_topic_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_topic_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sc TEXT;
BEGIN
  SELECT session_code INTO sc FROM conference_sessions WHERE id = NEW.session_id;
  INSERT INTO change_log (event_type, topic_id, topic_title, session_code, detail, notify)
  VALUES ('topic_added', NEW.id, NEW.topic_title, sc, cl_t(NEW.start_time) || ' â€“ ' || cl_t(NEW.end_time), false);
  RETURN NEW;
END $$;


--
-- Name: cl_topic_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cl_topic_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE sc TEXT; d TEXT := ''; r RECORD;
BEGIN
  IF OLD.topic_title IS DISTINCT FROM NEW.topic_title
     OR OLD.start_time IS DISTINCT FROM NEW.start_time
     OR OLD.end_time IS DISTINCT FROM NEW.end_time
     OR OLD.session_id IS DISTINCT FROM NEW.session_id THEN
    SELECT session_code INTO sc FROM conference_sessions WHERE id = NEW.session_id;
    IF OLD.topic_title IS DISTINCT FROM NEW.topic_title THEN
      d := d || 'Title: "' || COALESCE(OLD.topic_title, '') || '" â†’ "' || COALESCE(NEW.topic_title, '') || '". ';
    END IF;
    IF OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.end_time IS DISTINCT FROM NEW.end_time THEN
      d := d || 'Time: ' || cl_t(OLD.start_time) || ' â€“ ' || cl_t(OLD.end_time) || ' â†’ ' || cl_t(NEW.start_time) || ' â€“ ' || cl_t(NEW.end_time) || '. ';
    END IF;
    IF OLD.session_id IS DISTINCT FROM NEW.session_id THEN d := d || 'Moved to another session. '; END IF;
    INSERT INTO change_log (event_type, topic_id, topic_title, session_code, detail, notify)
    VALUES ('topic_edited', NEW.id, NEW.topic_title, sc, trim(d), false);
    FOR r IN SELECT ft.faculty_id, f.canonical_name FROM faculty_topics ft JOIN faculty f ON f.id = ft.faculty_id WHERE ft.topic_id = NEW.id LOOP
      INSERT INTO change_log (event_type, faculty_id, faculty_name, topic_id, topic_title, session_code, detail, notify)
      VALUES ('topic_edited', r.faculty_id, r.canonical_name, NEW.id, NEW.topic_title, sc, trim(d), true);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: resequence_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resequence_session(p_session_id uuid) RETURNS TABLE(topic_id uuid, new_seq integer)
    LANGUAGE plpgsql
    AS $$
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
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_log (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_type text NOT NULL,
    faculty_id uuid,
    faculty_name text,
    topic_id uuid,
    topic_title text,
    session_code text,
    detail text,
    notify boolean DEFAULT false NOT NULL,
    notified_at timestamp with time zone
);


--
-- Name: change_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.change_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.change_log_id_seq OWNED BY public.change_log.id;


--
-- Name: conference_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conference_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_code character varying(50) NOT NULL,
    session_name character varying(255) NOT NULL,
    session_date date,
    start_time time without time zone,
    end_time time without time zone,
    hall character varying(100),
    session_type text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: faculty; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    faculty_id text,
    canonical_name text NOT NULL,
    first_name text,
    last_name text,
    email text,
    alt_email text,
    phone text,
    country text,
    designation text,
    person_type text,
    is_active boolean DEFAULT true,
    is_faculty boolean DEFAULT false,
    is_coordinator boolean DEFAULT false,
    google_confirmed boolean DEFAULT false,
    google_email text,
    google_phone text,
    email_sent boolean DEFAULT false,
    email_sent_date timestamp with time zone,
    reminder_sent boolean DEFAULT false,
    whatsapp_sent boolean DEFAULT false,
    sessions_as_faculty integer,
    google_form_sync_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_confirmed boolean DEFAULT false,
    reviewed_at timestamp with time zone
);


--
-- Name: faculty_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty_topics (
    faculty_id uuid NOT NULL,
    topic_id uuid NOT NULL,
    role text DEFAULT 'Faculty'::text,
    confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone,
    sort_order integer
);


--
-- Name: faculty_topic_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.faculty_topic_counts AS
 SELECT faculty_id,
    (count(*))::integer AS topic_count
   FROM public.faculty_topics
  GROUP BY faculty_id;


--
-- Name: session_chairs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_chairs (
    session_id uuid NOT NULL,
    faculty_id uuid NOT NULL,
    sort_order integer,
    confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone
);


--
-- Name: session_coordinators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_coordinators (
    session_id uuid NOT NULL,
    faculty_id uuid NOT NULL,
    role text,
    coord_id integer
);


--
-- Name: session_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid,
    topic_title text NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    sequence_no integer,
    created_at timestamp with time zone DEFAULT now(),
    all_faculty_panel boolean DEFAULT false NOT NULL
);


--
-- Name: change_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log ALTER COLUMN id SET DEFAULT nextval('public.change_log_id_seq'::regclass);


--
-- Name: change_log change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_log
    ADD CONSTRAINT change_log_pkey PRIMARY KEY (id);


--
-- Name: conference_sessions conference_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conference_sessions
    ADD CONSTRAINT conference_sessions_pkey PRIMARY KEY (id);


--
-- Name: faculty faculty_faculty_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty
    ADD CONSTRAINT faculty_faculty_id_key UNIQUE (faculty_id);


--
-- Name: faculty faculty_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty
    ADD CONSTRAINT faculty_pkey PRIMARY KEY (id);


--
-- Name: faculty_topics faculty_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_topics
    ADD CONSTRAINT faculty_topics_pkey PRIMARY KEY (faculty_id, topic_id);


--
-- Name: session_chairs session_chairs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_chairs
    ADD CONSTRAINT session_chairs_pkey PRIMARY KEY (session_id, faculty_id);


--
-- Name: session_coordinators session_coordinators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_coordinators
    ADD CONSTRAINT session_coordinators_pkey PRIMARY KEY (session_id, faculty_id);


--
-- Name: session_topics session_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_topics
    ADD CONSTRAINT session_topics_pkey PRIMARY KEY (id);


--
-- Name: change_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_created_idx ON public.change_log USING btree (created_at);


--
-- Name: change_log_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX change_log_pending_idx ON public.change_log USING btree (faculty_id) WHERE (notify AND (notified_at IS NULL));


--
-- Name: conference_sessions_session_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conference_sessions_session_code_key ON public.conference_sessions USING btree (upper((session_code)::text));


--
-- Name: faculty_topics_topic_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faculty_topics_topic_id_idx ON public.faculty_topics USING btree (topic_id);


--
-- Name: faculty_topics cl_ft_delete_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_ft_delete_t AFTER DELETE ON public.faculty_topics FOR EACH ROW EXECUTE FUNCTION public.cl_ft_delete();


--
-- Name: faculty_topics cl_ft_insert_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_ft_insert_t AFTER INSERT ON public.faculty_topics FOR EACH ROW EXECUTE FUNCTION public.cl_ft_insert();


--
-- Name: faculty_topics cl_ft_update_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_ft_update_t AFTER UPDATE ON public.faculty_topics FOR EACH ROW EXECUTE FUNCTION public.cl_ft_update();


--
-- Name: conference_sessions cl_session_insert_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_session_insert_t AFTER INSERT ON public.conference_sessions FOR EACH ROW EXECUTE FUNCTION public.cl_session_insert();


--
-- Name: conference_sessions cl_session_update_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_session_update_t AFTER UPDATE ON public.conference_sessions FOR EACH ROW EXECUTE FUNCTION public.cl_session_update();


--
-- Name: session_topics cl_topic_delete_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_topic_delete_t BEFORE DELETE ON public.session_topics FOR EACH ROW EXECUTE FUNCTION public.cl_topic_delete();


--
-- Name: session_topics cl_topic_insert_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_topic_insert_t AFTER INSERT ON public.session_topics FOR EACH ROW EXECUTE FUNCTION public.cl_topic_insert();


--
-- Name: session_topics cl_topic_update_t; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cl_topic_update_t AFTER UPDATE ON public.session_topics FOR EACH ROW EXECUTE FUNCTION public.cl_topic_update();


--
-- Name: faculty_topics faculty_topics_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_topics
    ADD CONSTRAINT faculty_topics_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id) ON DELETE CASCADE;


--
-- Name: faculty_topics faculty_topics_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_topics
    ADD CONSTRAINT faculty_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.session_topics(id) ON DELETE CASCADE;


--
-- Name: session_chairs session_chairs_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_chairs
    ADD CONSTRAINT session_chairs_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id) ON DELETE CASCADE;


--
-- Name: session_chairs session_chairs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_chairs
    ADD CONSTRAINT session_chairs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.conference_sessions(id) ON DELETE CASCADE;


--
-- Name: session_coordinators session_coordinators_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_coordinators
    ADD CONSTRAINT session_coordinators_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.faculty(id) ON DELETE CASCADE;


--
-- Name: session_coordinators session_coordinators_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_coordinators
    ADD CONSTRAINT session_coordinators_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.conference_sessions(id) ON DELETE CASCADE;


--
-- Name: session_topics session_topics_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_topics
    ADD CONSTRAINT session_topics_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.conference_sessions(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cl_ft_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_ft_delete() TO anon;
GRANT ALL ON FUNCTION public.cl_ft_delete() TO authenticated;
GRANT ALL ON FUNCTION public.cl_ft_delete() TO service_role;


--
-- Name: FUNCTION cl_ft_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_ft_insert() TO anon;
GRANT ALL ON FUNCTION public.cl_ft_insert() TO authenticated;
GRANT ALL ON FUNCTION public.cl_ft_insert() TO service_role;


--
-- Name: FUNCTION cl_ft_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_ft_update() TO anon;
GRANT ALL ON FUNCTION public.cl_ft_update() TO authenticated;
GRANT ALL ON FUNCTION public.cl_ft_update() TO service_role;


--
-- Name: FUNCTION cl_session_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_session_insert() TO anon;
GRANT ALL ON FUNCTION public.cl_session_insert() TO authenticated;
GRANT ALL ON FUNCTION public.cl_session_insert() TO service_role;


--
-- Name: FUNCTION cl_session_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_session_update() TO anon;
GRANT ALL ON FUNCTION public.cl_session_update() TO authenticated;
GRANT ALL ON FUNCTION public.cl_session_update() TO service_role;


--
-- Name: FUNCTION cl_t(t time without time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_t(t time without time zone) TO anon;
GRANT ALL ON FUNCTION public.cl_t(t time without time zone) TO authenticated;
GRANT ALL ON FUNCTION public.cl_t(t time without time zone) TO service_role;


--
-- Name: FUNCTION cl_topic_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_topic_delete() TO anon;
GRANT ALL ON FUNCTION public.cl_topic_delete() TO authenticated;
GRANT ALL ON FUNCTION public.cl_topic_delete() TO service_role;


--
-- Name: FUNCTION cl_topic_insert(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_topic_insert() TO anon;
GRANT ALL ON FUNCTION public.cl_topic_insert() TO authenticated;
GRANT ALL ON FUNCTION public.cl_topic_insert() TO service_role;


--
-- Name: FUNCTION cl_topic_update(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cl_topic_update() TO anon;
GRANT ALL ON FUNCTION public.cl_topic_update() TO authenticated;
GRANT ALL ON FUNCTION public.cl_topic_update() TO service_role;


--
-- Name: FUNCTION resequence_session(p_session_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.resequence_session(p_session_id uuid) TO anon;
GRANT ALL ON FUNCTION public.resequence_session(p_session_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.resequence_session(p_session_id uuid) TO service_role;


--
-- Name: TABLE change_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.change_log TO anon;
GRANT ALL ON TABLE public.change_log TO authenticated;
GRANT ALL ON TABLE public.change_log TO service_role;


--
-- Name: SEQUENCE change_log_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.change_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.change_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.change_log_id_seq TO service_role;


--
-- Name: TABLE conference_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conference_sessions TO anon;
GRANT ALL ON TABLE public.conference_sessions TO authenticated;
GRANT ALL ON TABLE public.conference_sessions TO service_role;


--
-- Name: TABLE faculty; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.faculty TO anon;
GRANT ALL ON TABLE public.faculty TO authenticated;
GRANT ALL ON TABLE public.faculty TO service_role;


--
-- Name: TABLE faculty_topics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.faculty_topics TO anon;
GRANT ALL ON TABLE public.faculty_topics TO authenticated;
GRANT ALL ON TABLE public.faculty_topics TO service_role;


--
-- Name: TABLE faculty_topic_counts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.faculty_topic_counts TO anon;
GRANT ALL ON TABLE public.faculty_topic_counts TO authenticated;
GRANT ALL ON TABLE public.faculty_topic_counts TO service_role;


--
-- Name: TABLE session_chairs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_chairs TO anon;
GRANT ALL ON TABLE public.session_chairs TO authenticated;
GRANT ALL ON TABLE public.session_chairs TO service_role;


--
-- Name: TABLE session_coordinators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_coordinators TO anon;
GRANT ALL ON TABLE public.session_coordinators TO authenticated;
GRANT ALL ON TABLE public.session_coordinators TO service_role;


--
-- Name: TABLE session_topics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.session_topics TO anon;
GRANT ALL ON TABLE public.session_topics TO authenticated;
GRANT ALL ON TABLE public.session_topics TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--


