import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to convert 9:30 AM to 09:30:00
function formatTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;
  const clean = timeStr.trim().replace(/(\d)(AM|PM)/i, '$1 $2');
  const [time, modifier] = clean.split(' ');
  if (!time) return null;
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier && modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
  return `${hours.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
}

async function rebuildDatabase() {
  console.log("Starting complete database rebuild from CSV...");

  // 1. Fetch Faculty and Sessions to map IDs to UUIDs
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');

  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim().toUpperCase()] = s.id; });

  // 2. Read the CSV
  const fileContent = fs.readFileSync('tblsessiontopic.csv', 'utf-8');
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true, 
    trim: true, 
    relax_column_count: true,
    bom: true // Handles the invisible BOM character at the start of the file
  });

  console.log(`Found ${records.length} rows in CSV.`);

  let topicCount = 0;
  let linkCount = 0;

  // 3. Loop through the CSV and insert everything
  for (const row of records) {
    const sessionCode = row.SessionID?.trim().toUpperCase();
    const topicTitle = row.TopicTitle?.trim();
    
    // If there's no session or topic title, skip
    if (!sessionCode || !topicTitle) continue;

    const session_uuid = sessionMap[sessionCode];
    if (!session_uuid) {
      console.log(`⚠️ Session not found: ${sessionCode}`);
      continue;
    }

    // 4. Insert the Topic
    const { data: newTopic, error: topicError } = await supabase
      .from('session_topics')
      .insert({
        session_id: session_uuid,
        topic_title: topicTitle,
        sequence_no: parseInt(row.SequenceNo) || null,
        start_time: formatTime(row.StartTime),
        end_time: formatTime(row.EndTime)
      })
      .select('id')
      .single();

    if (topicError) {
      console.error(`❌ Error inserting "${topicTitle}":`, topicError.message);
      continue;
    }

    topicCount++;

    // 5. Link the Faculty (if they exist)
    const facultyCode = row.FacultyID?.trim().toUpperCase();
    const faculty_uuid = facultyMap[facultyCode];

    if (faculty_uuid && newTopic) {
      const { error: linkError } = await supabase
        .from('faculty_topics')
        .insert({
          faculty_id: faculty_uuid,
          topic_id: newTopic.id,
          role: row.Role?.trim() || 'Faculty'
        });

      if (!linkError) linkCount++;
    }
  }

  console.log(`\n🎉 REBUILD COMPLETE!`);
  console.log(`✅ Topics Inserted: ${topicCount}`);
  console.log(`✅ Faculty Links Created: ${linkCount}`);
}

rebuildDatabase();
