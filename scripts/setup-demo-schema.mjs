// scripts/setup-demo-schema.mjs
// Creates (or rebuilds) the "demo" schema: an empty structural copy of every
// table, view and function in "public". Demo Mode reads/writes only this schema,
// so your real data is never touched.
//
//   npm run demo:setup     # create/refresh structure + fill with dummy data
//
// Re-run it after you change the database structure so the demo copy matches.
// WARNING: it recreates "demo" from scratch (demo edits are discarded; "public" is not touched).

import { spawnSync } from "node:child_process";
import pg from "pg";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const q = async (sql, params) => (await client.query(sql, params)).rows;
const rewrite = (sql) => sql.replace(/\bpublic\./g, "demo.");

try {
  await client.query("BEGIN");
  await client.query("DROP SCHEMA IF EXISTS demo CASCADE");
  await client.query("CREATE SCHEMA demo");

  const tables = (await q(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  )).map(r => r.tablename);

  for (const t of tables) {
    await client.query(`CREATE TABLE demo."${t}" (LIKE public."${t}" INCLUDING ALL)`);
    await client.query(`ALTER TABLE demo."${t}" DISABLE ROW LEVEL SECURITY`);
  }

  // Foreign keys: same rules, pointing at the demo copies
  const fks = await q(`
    SELECT c.conrelid::regclass::text AS tbl, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.contype='f' AND n.nspname='public'`);
  for (const fk of fks) {
    const tbl = fk.tbl.replace(/^public\./, "").replace(/"/g, "");
    const def = fk.def.replace(/REFERENCES\s+(?:public\.)?("?\w+"?)/, "REFERENCES demo.$1");
    await client.query(`ALTER TABLE demo."${tbl}" ADD CONSTRAINT "${fk.conname}" ${def}`);
  }

  // Views and functions are created with "demo" first in the search path, so any
  // unqualified table name inside them resolves to the demo copy, never to public.
  await client.query("SET LOCAL search_path = demo, public");

  // Views
  const views = await q("SELECT viewname, definition FROM pg_views WHERE schemaname='public'");
  for (const v of views) {
    await client.query(`CREATE VIEW demo."${v.viewname}" AS ${rewrite(v.definition)}`);
  }

  // Functions (e.g. resequence_session) - body is rewritten to use demo tables
  const fns = await q(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')`);
  for (const f of fns) await client.query(rewrite(f.def));

  await client.query("SET LOCAL search_path = public");
  await client.query("GRANT USAGE ON SCHEMA demo TO anon, authenticated, service_role");
  await client.query("GRANT ALL ON ALL TABLES IN SCHEMA demo TO anon, authenticated, service_role");
  await client.query("GRANT ALL ON ALL SEQUENCES IN SCHEMA demo TO anon, authenticated, service_role");
  await client.query("GRANT ALL ON ALL FUNCTIONS IN SCHEMA demo TO anon, authenticated, service_role");
  await client.query("NOTIFY pgrst, 'reload schema'");
  await client.query("COMMIT");
  console.log(`demo schema ready: ${tables.length} tables, ${views.length} views, ${fns.length} functions.`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}

console.log("Filling demo schema with dummy data...");
const r = spawnSync(process.execPath, ["scripts/seed-local.mjs", "--dataset=dummy", "--schema=demo", "--force"], { stdio: "inherit" });
process.exit(r.status ?? 0);
