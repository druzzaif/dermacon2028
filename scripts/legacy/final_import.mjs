import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runFinalImport() {
  console.log("Starting FINAL import using TopicID...");

  // 1. Fetch Faculty to map FAC001 -> UUID
  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  // 2. Fetch all Topics to map TopicID (886) -> UUID
  const { data: topics } = await supabase.from('session_topics').select('id, sequence_no');
  // We can't map by sequence_no alone, so let's get a list of all topic IDs and match by title
  const { data: allTopics } = await supabase.from('session_topics').select('id, topic_title');
  
  // 3. Read the file
  const fileContent = fs.readFileSync('final_import.csv', 'utf-8');
  const records = parse(fileContent, { 
    columns: true, 
    skip_empty_lines: true, 
    trim: true, 
    relax_column_count: true,
    delimiter: '\t' // The file you pasted is tab-delimited
  });

  console.log(`Found ${records.length} rows in file.`);
  
  // Clear the old broken links
  await supabase.from('faculty_topics').delete().neq('faculty_id', '00000000-0000-0000-0000-000000000000');
  console.log("Cleared old links.");

  let linkedCount = 0;

  for (const row of records) {
    const facultyCode = row.FacultyID?.trim().toUpperCase();
    const topicTitle = row.Topic?.trim(); // Here is the fix: it's row.Topic, not row.TopicTitle
    const role = row.Role?.trim() || 'Faculty';

    if (!facultyCode || !topicTitle || topicTitle === '') continue;

    const faculty_uuid = facultyMap[facultyCode];
    if (!faculty_uuid) continue;

    // Find the topic UUID by the exact title
    const matchedTopic = allTopics.find(t => 
      t.topic_title && t.topic_title.trim().toLowerCase() === topicTitle.toLowerCase()
    );

    if (matchedTopic) {
      const { error } = await supabase
        .from('faculty_topics')
        .insert({
          faculty_id: faculty_uuid,
          topic_id: matchedTopic.id,
          role: role
        });
      
      if (!error) {
        linkedCount++;
      } else if (error.code !== '23505') {
        // Ignore duplicate errors
        console.log(`Error on "${topicTitle}":`, error.message);
      }
    }
  }

  console.log(`\n🎉 FINAL SUCCESS! Re-linked ${linkedCount} topics.`);
  
  // Refresh the View
  await supabase.rpc('refresh_faculty_topic_counts').catch(() => {});
}

runFinalImport();
