import fs from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function debugImport() {
  await client.connect();
  
  const fileContent = fs.readFileSync('faculty.csv', 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  
  console.log("Total records in CSV:", records.length);
  console.log("First record object:", records[0]);

  const columns = Object.keys(records[0]);
  const row = records[0];
  
  const booleanCols = ['is_active', 'is_faculty', 'is_coordinator', 'google_confirmed', 'email_sent', 'reminder_sent', 'whatsapp_sent'];
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

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const query = `INSERT INTO faculty (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

  console.log("\n--- ATTEMPTING TO INSERT FIRST ROW ---");
  try {
    await client.query(query, values);
    console.log("✅ SUCCESS! The first row worked.");
  } catch (err) {
    console.error("❌ FAILED ON FIRST ROW:", err.message);
    console.error("Detailed Error:", err.detail);
  }

  await client.end();
}

debugImport();
