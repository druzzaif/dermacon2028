import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}

function formatTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;
  const clean = timeStr.trim().replace(/(\d)(AM|PM)/i, '$1 $2');
  const [time, modifier] = clean.split(' ');
  if (!time) return null;
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier && modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

async function importTopics() {
  console.log("Starting topics import...");

  const fileContent = fs.readFileSync('topics_export.csv', 'utf-8');
  const lines = fileContent.split('\n').filter(l => l.trim() !== '');
  
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');

  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim()] = s.id; });

  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim()] = f.id; });

  let successCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 7) continue;

    const accessSessionId = parts[1];
    const sequence_no = parts[2];
    const start_time = parts[3];
    const end_time = parts[4];
    const topic_title = parts[5];
    const accessFacultyId = parts[6];
    const role = parts[7] || 'Faculty';

    const session_uuid = sessionMap[accessSessionId];
    if (!session_uuid) continue;

    // 1. Insert the Topic (Even if faculty is missing or duplicated)
    const { data: newTopic, error: topicError } = await supabase
      .from('session_topics')
      .insert({
        session_id: session_uuid,
        topic_title: topic_title,
        sequence_no: parseInt(sequence_no) || null,
        start_time: formatTime(start_time),
        end_time: formatTime(end_time)
      })
      .select('id')
      .single();

    if (topicError) continue;

    // 2. Try to link the Faculty
    const faculty_uuid = facultyMap[accessFacultyId];

    if (faculty_uuid && newTopic) {
      const { error: linkError } = await supabase
        .from('faculty_topics')
        .insert({
          faculty_id: faculty_uuid,
          topic_id: newTopic.id,
          role: role
        });
      
      // If linkError exists (like a duplicate), we just ignore it.
      // The topic is already safely saved.
    }

    successCount++;
    if (successCount % 50 === 0) console.log(`✅ Processed ${successCount} topics...`);
  }

  console.log(`\n🎉 Import Complete!`);
  console.log(`✅ Total Topics Inserted: ${successCount}`);
}

importTopics();