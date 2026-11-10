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

  // 1. Fetch Session/Topic Data
  const { data: facultyTopics } = await s.from('faculty_topics')
    .select(`role, session_topics ( topic_title, start_time, end_time, sequence_no, conference_sessions ( id, session_code, session_name, session_date, hall, start_time, end_time ) )`)
    .eq('faculty_id', testId);

  if (!facultyTopics) return console.log("No topics.");

  // 2. Fetch Coordinators
  const sessionIds = [...new Set(facultyTopics.map(ft => ft.session_topics?.conference_sessions?.id).filter(Boolean))];
  const { data: coords } = await s.from('session_coordinators')
    .select('session_id, role, faculty ( canonical_name, phone, email )')
    .in('session_id', sessionIds)
    .eq('role', 'Lead Coordinator');
    
  const coordMap = {};
  if (coords) coords.forEach(c => coordMap[c.session_id] = c.faculty);

  // 3. Build the Payload
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
      time: fmt12h(topic.start_time) + ' - ' + fmt12h(topic.end_time),
      date: fmtDate(session.session_date),
      session_time: fmt12h(session.start_time) + ' - ' + fmt12h(session.end_time),
      coordName: coord.canonical_name,
      coordPhone: coord.phone,
      coordEmail: coord.email,
      sequence_no: topic.sequence_no
    }];
  }).sort((a, b) => String(a.session_code).localeCompare(String(b.session_code), undefined, { numeric: true }) || (a.sequence_no - b.sequence_no));

  console.log('--- EXACT DATA PULLED FROM DB ---');
  console.log(JSON.stringify(sessionsData, null, 2));
  
  // Create a visual HTML sample
  let html = '<html><body style="font-family:Arial; padding:20px;">';
  html += '<h2>' + f.canonical_name + '</h2>';
  sessionsData.forEach((row, i) => {
    html += '<div style="border:1px solid #ccc; padding:10px; margin-bottom:10px;">';
    html += '<h3>Topic ' + (i+1) + '</h3>';
    html += '<p><b>Session:</b> ' + row.session_code + ' ' + row.session_name + '</p>';
    html += '<p><b>Topic:</b> ' + row.topic + '</p>';
    html += '<p><b>Time:</b> ' + row.time + '</p>';
    html += '<p><b>Date:</b> ' + row.date + '</p>';
    html += '<p><b>Session Time:</b> ' + row.session_time + '</p>';
    html += '<p><b>Coordinator:</b> ' + row.coordName + ' | ' + row.coordPhone + ' | ' + row.coordEmail + '</p>';
    html += '</div>';
  });
  html += '</body></html>';

  fs.writeFileSync('sample-data.html', html);
  require('child_process').exec('start sample-data.html');
}
run();