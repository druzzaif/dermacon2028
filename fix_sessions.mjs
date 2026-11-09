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

async function fixSessions() {
  console.log("Fixing session links...");

  // 1. Get all sessions to map their Codes (WS2) to their UUIDs
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim()] = s.id; });

  // 2. Read the CSV
  const fileContent = fs.readFileSync('topics_export.csv', 'utf-8');
  const lines = fileContent.split('\n').filter(l => l.trim() !== '');
  
  let fixedCount = 0;

  // 3. Loop through each topic in the CSV
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 7) continue;

    const session_code = parts[1]; // e.g., 'WS2'
    const topic_title = parts[5];
    
    const correct_uuid = sessionMap[session_code];
    
    if (!correct_uuid) {
      console.log(`⚠️ Could not find session code: ${session_code}`);
      continue;
    }

    // 4. Update the database where the topic title matches
    // (We use topic_title because the script that imported them might have 
    // missed the sequence number, but the title is unique enough).
    const { error } = await supabase
      .from('session_topics')
      .update({ session_id: correct_uuid })
      .eq('topic_title', topic_title);

    if (error) {
      console.error(`❌ Error fixing "${topic_title}":`, error.message);
    } else {
      fixedCount++;
    }
  }

  console.log(`\n🎉 Done! Re-linked ${fixedCount} topics to their correct sessions.`);
}

fixSessions();