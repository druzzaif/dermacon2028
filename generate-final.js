const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function fmt12h(t) {
  if (!t) return '--:--';
  const parts = t.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parts[1].substring(0, 2) : '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return h + ':' + m + ' ' + ampm;
}

function fmtDate(d) {
  if (!d) return '--';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function run() {
  const testId = "778f72c8-b07c-4385-80ca-7d0356cdd108"; // Dr Uzzaif
  const { data: f } = await s.from('faculty').select('canonical_name').eq('id', testId).single();

  // Fetch Topics/Sessions
  const { data: facultyTopics } = await s.from('faculty_topics')
    .select(`role, session_topics ( topic_title, start_time, end_time, sequence_no, conference_sessions ( id, session_code, session_name, session_date, hall, start_time, end_time ) )`)
    .eq('faculty_id', testId);

  // Fetch Coordinators
  const sessionIds = [...new Set(facultyTopics.map(ft => ft.session_topics?.conference_sessions?.id).filter(Boolean))];
  const { data: coords } = await s.from('session_coordinators')
    .select('session_id, role, faculty ( canonical_name, phone, email )')
    .in('session_id', sessionIds)
    .eq('role', 'Lead Coordinator');
    
  const coordMap = {};
  if (coords) coords.forEach(c => coordMap[c.session_id] = c.faculty);

  // Build flat list
  const sessionsData = facultyTopics.flatMap(ft => {
    const session = ft.session_topics?.conference_sessions;
    const topic = ft.session_topics;
    if (!session || !topic) return [];
    const coord = coordMap[session.id] || { canonical_name: 'Scientific Committee', phone: '', email: '' };

    return [{
      session_code: session.session_code,
      session_name: session.session_name,
      session_hall: session.hall || 'TBD',
      topic: topic.topic_title || '',
      time: `${fmt12h(topic.start_time)} - ${fmt12h(topic.end_time)}`,
      date: fmtDate(session.session_date),
      session_time: `${fmt12h(session.start_time)} - ${fmt12h(session.end_time)}`,
      coordName: coord.canonical_name,
      coordPhone: coord.phone,
      coordEmail: coord.email,
      sequence_no: topic.sequence_no
    }];
  });

  // Load Template
  const template = fs.readFileSync('dermacon2027_template.html', 'utf8');
  const startMarker = '<!-- SESSION_START -->';
  const endMarker = '<!-- SESSION_END -->';
  const startIndex = template.indexOf(startMarker);
  const endIndex = template.indexOf(endMarker);

  const blockTemplate = template.substring(startIndex + startMarker.length, endIndex);
  let sessionBlocksHtml = '';

  sessionsData.forEach((row, i) => {
    let block = blockTemplate;
    block = block.replace(/\{\{SessionNumber\}\}/g, String(i + 1));
    block = block.replace(/\{\{Topic\}\}/g, row.topic);
    block = block.replace(/\{\{Timing\}\}/g, row.time);
    block = block.replace(/\{\{SessionName\}\}/g, `${row.session_code} ${row.session_name}`);
    block = block.replace(/\{\{Hall\}\}/g, row.session_hall);
    block = block.replace(/\{\{Date\}\}/g, row.date);
    block = block.replace(/\{\{SessionTime\}\}/g, row.session_time);
    block = block.replace(/\{\{CoordName\}\}/g, row.coordName);
    block = block.replace(/\{\{CoordPhone\}\}/g, row.coordPhone);
    block = block.replace(/\{\{CoordEmail\}\}/g, row.coordEmail);
    sessionBlocksHtml += block;
  });

  let finalHtml = template.substring(0, startIndex) + sessionBlocksHtml + template.substring(endIndex + endMarker.length);
  finalHtml = finalHtml.replace(/\{\{FacultyName\}\}/g, f.canonical_name);
  finalHtml = finalHtml.replace(/\{\{Role\}\}/g, 'Faculty');
  finalHtml = finalHtml.replace(/\{\{LetterDate\}\}/g, new Date().toLocaleDateString('en-GB'));
  finalHtml = finalHtml.replace('https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK', '#');

  fs.writeFileSync('final-email-sample.html', finalHtml);
  console.log('Success! Created final-email-sample.html');
  require('child_process').exec('start final-email-sample.html');
}
run();