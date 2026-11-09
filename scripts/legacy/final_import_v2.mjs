import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to normalize strings for fuzzy matching
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all spaces and punctuation
    .trim();
}

async function runFinalImport() {
  console.log("Starting FINAL import (Fuzzy Match)...");

  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  const { data: allTopics } = await supabase.from('session_topics').select('id, topic_title');
  
  const fileContent = fs.readFileSync('final_import.csv', 'utf-8');
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true, 
    trim: true, 
    relax_column_count: true,
    delimiter: '\t'
  });

  console.log(`Found ${records.length} rows in file.`);
  
  await supabase.from('faculty_topics').delete().neq('faculty_id', '00000000-0000-0000-0000-000000000000');
  console.log("Cleared old links.");

  let linkedCount = 0;

  for (const row of records) {
    const facultyCode = row.FacultyID?.trim().toUpperCase();
    const topicTitle = row.Topic?.trim(); 
    const role = row.Role?.trim() || 'Faculty';

    if (!facultyCode || !topicTitle || topicTitle === '') continue;

    const faculty_uuid = facultyMap[facultyCode];
    if (!faculty_uuid) continue;

    const normalizedFileTitle = normalize(topicTitle);

    // Find the topic with a fuzzy match
    const matchedTopic = allTopics.find(t => 
      normalize(t.topic_title) === normalizedFileTitle
    );

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

  console.log(`\n🎉 SUCCESS! Re-linked ${linkedCount} topics.`);
}

runFinalImport();
