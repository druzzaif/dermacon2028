import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importCoordinators() {
  console.log("Starting coordinator import...");

  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');

  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim().toUpperCase()] = s.id; });

  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  const fileContent = fs.readFileSync('coordinators_export.txt', 'utf-8');
  const lines = fileContent.split('\n').filter(l => l.trim() !== '');
  
  let successCount = 0;
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    if (parts.length < 3) continue;

    const session_code = parts[0]?.trim().toUpperCase();
    const faculty_code = parts[1]?.trim().toUpperCase();
    const role = parts[2]?.trim();
    const coord_id = parts[3] ? parseInt(parts[3].trim()) : null;

    if (!session_code || !faculty_code) continue;

    const session_uuid = sessionMap[session_code];
    const faculty_uuid = facultyMap[faculty_code];

    if (!session_uuid) {
      console.log(`⚠️ Session not found: ${session_code}`);
      continue;
    }

    if (!faculty_uuid) {
      console.log(`⚠️ Faculty not found: ${faculty_code} (Skipping)`);
      continue;
    }

    const { error } = await supabase
      .from('session_coordinators')
      .insert({
        session_id: session_uuid,
        faculty_id: faculty_uuid,
        role: role,
        coord_id: coord_id
      });

    if (error) {
      if (error.code !== '23505') { 
        console.error(`❌ Error linking ${faculty_code} to ${session_code}:`, error.message);
        errorCount++;
      }
    } else {
      successCount++;
    }
  }

  console.log(`\n🎉 Coordinator Import Complete!`);
  console.log(`✅ Successfully linked: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

importCoordinators();