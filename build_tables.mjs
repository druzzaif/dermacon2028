import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function build() {
  await client.connect();
  console.log("Connected to local Windows database. Building tables...");
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS faculty (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), faculty_id TEXT UNIQUE, canonical_name TEXT NOT NULL, first_name TEXT, last_name TEXT, email TEXT, alt_email TEXT, phone TEXT, country TEXT, designation TEXT, person_type TEXT, is_active BOOLEAN DEFAULT true, is_faculty BOOLEAN DEFAULT false, is_coordinator BOOLEAN DEFAULT false, google_confirmed BOOLEAN DEFAULT false, google_email TEXT, google_phone TEXT, email_sent BOOLEAN DEFAULT false, email_sent_date TIMESTAMPTZ, reminder_sent BOOLEAN DEFAULT false, whatsapp_sent BOOLEAN DEFAULT false, sessions_as_faculty INTEGER, google_form_sync_date TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS conference_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_code VARCHAR(50) NOT NULL, session_name VARCHAR(255) NOT NULL, session_date DATE, start_time TIME, end_time TIME, hall VARCHAR(100), session_type TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS session_topics (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), session_id UUID REFERENCES conference_sessions(id) ON DELETE CASCADE, topic_title TEXT NOT NULL, start_time TIME, end_time TIME, sequence_no INTEGER, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS faculty_topics (faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE, topic_id UUID REFERENCES session_topics(id) ON DELETE CASCADE, role TEXT DEFAULT 'Faculty', PRIMARY KEY (faculty_id, topic_id));
      CREATE TABLE IF NOT EXISTS session_coordinators (session_id UUID REFERENCES conference_sessions(id) ON DELETE CASCADE, faculty_id UUID REFERENCES faculty(id) ON DELETE CASCADE, role TEXT, coord_id INTEGER, PRIMARY KEY (session_id, faculty_id));
      CREATE OR REPLACE VIEW faculty_topic_counts AS SELECT faculty_id, COUNT(topic_id)::integer as topic_count FROM faculty_topics GROUP BY faculty_id;
      ALTER TABLE faculty DISABLE ROW LEVEL SECURITY; ALTER TABLE conference_sessions DISABLE ROW LEVEL SECURITY; ALTER TABLE session_topics DISABLE ROW LEVEL SECURITY; ALTER TABLE faculty_topics DISABLE ROW LEVEL SECURITY; ALTER TABLE session_coordinators DISABLE ROW LEVEL SECURITY;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT SELECT ON faculty_topic_counts TO anon, authenticated, service_role;
    `);
    console.log("? Tables built successfully!");
  } catch (err) { console.error("? Error building tables:", err.message); }
  await client.end();
}
build();
