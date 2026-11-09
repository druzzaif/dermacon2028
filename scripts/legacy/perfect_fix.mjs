import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllTopics() {
  console.log("1. Wiping old broken links...");
  // Delete all links by targeting a non-existent UUID (this deletes everything)
  await supabase.from('faculty_topics').delete().neq('faculty_id', '00000000-0000-0000-0000-000000000000');

  console.log("2. Fetching UUIDs from database...");
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  
  // We only need the id and sequence_no to link them
  const { data: topics } = await supabase.from('session_topics').select('id, sequence_no, session_id');

  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });
  
  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim().toUpperCase()] = s.id; });

  console.log("3. Reading CSV file...");
  const fileContent = fs.readFileSync('topics_export.csv', 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });

  let linkedCount = 0;

  console.log("4. Linking topics...");
  for (const row of records) {
    const sessionCode = row.SessionID?.trim().toUpperCase();
    const seqNo = parseInt(row.SequenceNo);
    const facultyCode = row.FacultyID?.trim().toUpperCase();
    const role = row.Role?.trim() || 'Faculty';

    if (!sessionCode || isNaN(seqNo) || !facultyCode) continue;

    const session_uuid = sessionMap[sessionCode];
    const faculty_uuid = facultyMap[facultyCode];

    if (!session_uuid || !faculty_uuid) continue;

    // Find the topic by Session and Sequence Number (100% accurate)
    const matchedTopic = topics.find(t => t.session_id === session_uuid && t.sequence_no === seqNo);

    if (matchedTopic) {
      const { error } = await supabase
        .from('faculty_topics')
        .insert({
          faculty_id: faculty_uuid,
          topic_id: matchedTopic.id,
          role: role
        });

      if (!error) linkedCount++;
    }
  }

  console.log(`\n🎉 Perfectly re-linked ${linkedCount} topics to their faculty!`);
}

fixAllTopics();
