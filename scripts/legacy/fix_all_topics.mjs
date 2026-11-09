import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAllTopics() {
  console.log("Starting Master Fix...");

  // 1. Fetch Faculty
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  // 2. Fetch Sessions
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim().toUpperCase()] = s.id; });

  // 3. Fetch Topics
  const { data: topics } = await supabase.from('session_topics').select('id, topic_title, session_id');
  
  // 4. Read CSV
  const fileContent = fs.readFileSync('topics_export.csv', 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });

  let linkedCount = 0;

  for (const row of records) {
    const sessionCode = row.SessionID?.trim().toUpperCase();
    const facultyCode = row.FacultyID?.trim().toUpperCase();
    const topicTitle = row.TopicTitle?.trim();
    const role = row.Role?.trim() || 'Faculty';

    if (!sessionCode || !facultyCode || !topicTitle) continue;

    const session_uuid = sessionMap[sessionCode];
    const faculty_uuid = facultyMap[facultyCode];

    if (!session_uuid || !faculty_uuid) continue;

    // Find the topic UUID by matching the Title and Session ID
    const matchedTopic = topics.find(t => 
      t.session_id === session_uuid && 
      t.topic_title.trim().toLowerCase() === topicTitle.toLowerCase()
    );

    if (matchedTopic) {
      const { error } = await supabase
        .from('faculty_topics')
        .upsert({
          faculty_id: faculty_uuid,
          topic_id: matchedTopic.id,
          role: role
        }, { onConflict: 'faculty_id, topic_id' });

      if (!error) linkedCount++;
    }
  }

  console.log(`🎉 Re-linked ${linkedCount} topics to their faculty!`);
}

fixAllTopics();
