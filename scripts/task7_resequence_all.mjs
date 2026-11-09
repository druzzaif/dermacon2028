import pkg from "pg";
const { Client } = pkg;

const client = new Client({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});
await client.connect();

const sessions = await client.query(
  "SELECT id, session_code FROM conference_sessions ORDER BY session_code"
);
console.log(`   Resequencing ${sessions.rowCount} session(s)...`);

let changed = 0;
for (const s of sessions.rows) {
  const before = await client.query(
    "SELECT id, sequence_no FROM session_topics WHERE session_id = $1 ORDER BY id",
    [s.id]
  );
  await client.query("SELECT * FROM resequence_session($1)", [s.id]);
  const after = await client.query(
    "SELECT id, sequence_no FROM session_topics WHERE session_id = $1 ORDER BY id",
    [s.id]
  );
  const beforeMap = new Map(before.rows.map(r => [r.id, r.sequence_no]));
  const diff = after.rows.filter(r => beforeMap.get(r.id) !== r.sequence_no).length;
  if (diff > 0) {
    console.log(`   ${s.session_code.padEnd(6)}  ${diff} topic(s) renumbered`);
    changed += diff;
  }
}

console.log(`\n   Total topics renumbered: ${changed}`);

// Report any remaining duplicate (session, seq) pairs - these are co-presenters
const dup = await client.query(`
  SELECT s.session_code, t.sequence_no, COUNT(*) AS n
  FROM session_topics t
  JOIN conference_sessions s ON s.id = t.session_id
  GROUP BY s.session_code, t.sequence_no
  HAVING COUNT(*) > 1
  ORDER BY s.session_code, t.sequence_no
`);
console.log(`\n   Duplicate (session, seq) groups (co-presenters, expected):`);
console.log(`   ${dup.rowCount} group(s) - each is one topic with 2+ faculty`);
if (dup.rowCount > 0) {
  for (const r of dup.rows.slice(0, 10)) {
    console.log(`     ${r.session_code.padEnd(6)} seq ${String(r.sequence_no).padStart(2)} -> ${r.n} faculty`);
  }
}

await client.end();