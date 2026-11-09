import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessions() {
  // 1. Get all sessions
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code, session_name');
  
  // 2. Get all topics
  const { data: topics } = await supabase.from('session_topics').select('session_id');

  console.log("--- SESSION TOPIC COUNTS ---");
  
  // Count topics per session
  const topicCounts = {};
  topics.forEach(t => {
    topicCounts[t.session_id] = (topicCounts[t.session_id] || 0) + 1;
  });

  // Display results
  sessions.forEach(s => {
    const count = topicCounts[s.id] || 0;
    if (count === 0) {
      console.log(`⚠️  ${s.session_code}: 0 topics (${s.session_name})`);
    } else {
      console.log(`✅ ${s.session_code}: ${count} topics`);
    }
  });
}

checkSessions();