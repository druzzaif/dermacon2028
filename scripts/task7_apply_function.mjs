import fs from "node:fs";
import pkg from "pg";
const { Client } = pkg;

const sql = fs.readFileSync("scripts/task7_resequence.sql", "utf-8");
const client = new Client({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});
await client.connect();
try {
  await client.query(sql);
  console.log("   Function public.resequence_session(UUID) created.");
} catch (err) {
  console.error("   FAILED:", err.message);
  await client.end();
  process.exit(1);
}
await client.end();