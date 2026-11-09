import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });

async function importData() {
  await client.connect();
  console.log("Importing data from CSVs...");
  const tables = [
    { name: 'faculty', file: 'faculty.csv' },
    { name: 'conference_sessions', file: 'conference_sessions.csv' },
    { name: 'session_topics', file: 'session_topics.csv' },
    { name: 'session_coordinators', file: 'session_coordinators.csv' },
    { name: 'faculty_topics', file: 'faculty_topics.csv' },
  ];
  for (const table of tables) {
    if (!fs.existsSync(table.file)) { console.log(`?? Skipping ${table.file}`); continue; }
    const records = parse(fs.readFileSync(table.file, 'utf-8'), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const columns = Object.keys(records[0]);
    const booleanCols = ['is_active', 'is_faculty', 'is_coordinator', 'google_confirmed', 'email_sent', 'reminder_sent', 'whatsapp_sent'];
    let inserted = 0; let failed = 0;
    for (const row of records) {
      const values = columns.map(c => {
        let val = row[c];
        if (val === undefined || val === '') return null;
        if (booleanCols.includes(c)) { if (val === 'true') return true; if (val === 'false') return false; return null; }
        return val;
      });
      let query = `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`;
      try { await client.query(query, values); inserted++; } catch (err) { failed++; }
    }
    console.log(`? ${table.name}: Inserted ${inserted} | Failed ${failed}`);
  }
  await client.end();
  console.log("?? Data import complete!");
}
importData();
