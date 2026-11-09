import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function importData() {
  await client.connect();
  console.log("Connected to local database.");

  // 1. Temporarily drop foreign keys so we can import the exact UUIDs
  console.log("Dropping foreign key constraints temporarily...");
  await client.query(`ALTER TABLE faculty_topics DROP CONSTRAINT IF EXISTS faculty_topics_faculty_id_fkey;`);
  await client.query(`ALTER TABLE faculty_topics DROP CONSTRAINT IF EXISTS faculty_topics_topic_id_fkey;`);
  await client.query(`ALTER TABLE session_coordinators DROP CONSTRAINT IF EXISTS session_coordinators_faculty_id_fkey;`);
  await client.query(`ALTER TABLE session_coordinators DROP CONSTRAINT IF EXISTS session_coordinators_session_id_fkey;`);
  await client.query(`ALTER TABLE session_topics DROP CONSTRAINT IF EXISTS session_topics_session_id_fkey;`);

  const tables = [
    { name: 'faculty', file: 'faculty.csv' },
    { name: 'conference_sessions', file: 'conference_sessions.csv' },
    { name: 'session_topics', file: 'session_topics.csv' },
    { name: 'session_coordinators', file: 'session_coordinators.csv' },
    { name: 'faculty_topics', file: 'faculty_topics.csv' },
  ];

  for (const table of tables) {
    if (!fs.existsSync(table.file)) continue;
    console.log(`Importing ${table.file}...`);
    const fileContent = fs.readFileSync(table.file, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    if (records.length === 0) continue;

    const columns = Object.keys(records[0]);
    const booleanCols = ['is_active', 'is_faculty', 'is_coordinator', 'google_confirmed', 'email_sent', 'reminder_sent', 'whatsapp_sent'];
    let inserted = 0; let errors = 0;

    for (const row of records) {
      const values = columns.map(c => {
        let val = row[c];
        if (val === undefined || val === '') return null;
        if (booleanCols.includes(c)) {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return null;
        }
        return val;
      });
      
      // We use ON CONFLICT (id) DO NOTHING for faculty and sessions so it keeps the exact UUIDs
      let query = `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`;
      if (table.name === 'faculty' || table.name === 'conference_sessions' || table.name === 'session_topics') {
         query += ` ON CONFLICT (id) DO NOTHING`;
      } else {
         query += ` ON CONFLICT DO NOTHING`;
      }
      
      try {
        await client.query(query, values);
        inserted++;
      } catch (err) {
        errors++;
      }
    }
    console.log(`   ✅ Inserted: ${inserted} | ❌ Failed: ${errors}`);
  }

  // 2. Re-add the constraints (optional, but good for data integrity)
  console.log("Re-adding foreign key constraints...");
  await client.query(`ALTER TABLE session_topics ADD CONSTRAINT session_topics_session_id_fkey FOREIGN KEY (session_id) REFERENCES conference_sessions(id) ON DELETE CASCADE;`);
  await client.query(`ALTER TABLE faculty_topics ADD CONSTRAINT faculty_topics_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE;`);
  await client.query(`ALTER TABLE faculty_topics ADD CONSTRAINT faculty_topics_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES session_topics(id) ON DELETE CASCADE;`);
  await client.query(`ALTER TABLE session_coordinators ADD CONSTRAINT session_coordinators_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE;`);
  await client.query(`ALTER TABLE session_coordinators ADD CONSTRAINT session_coordinators_session_id_fkey FOREIGN KEY (session_id) REFERENCES conference_sessions(id) ON DELETE CASCADE;`);

  await client.end();
  console.log("🎉 Local import complete!");
}

importData();
