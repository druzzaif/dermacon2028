const fs = require('fs');
const env = {};
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach(l => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const testId = "778f72c8-b07c-4385-80ca-7d0356cdd108"; // Dr Uzzaif Mansuri ID

  const { data: f } = await s.from('faculty').select('canonical_name').eq('id', testId).single();
  
  const { data: facultyTopics } = await s.from('faculty_topics')
    .select('role, session_topics ( topic_title, start_time, end_time, sequence_no, conference_sessions ( id, session_code, session_name, session_date, hall, start_time, end_time ) )')
    .eq('faculty_id', testId);

  if (!facultyTopics) { console.log('No topics found'); return; }

  const sessionIds = [...new Set(facultyTopics.map(ft => ft.session_topics?.conference_sessions?.id).filter(Boolean))];
  const { data: coords } = await s.from('session_coordinators')
    .select('session_id, role, faculty ( canonical_name, phone, email )')
    .in('session_id', sessionIds)
    .eq('role', 'Lead Coordinator');
    
  const coordMap = {};
  if (coords) coords.forEach(c => coordMap[c.session_id] = c.faculty);

  const templateFile = fs.readFileSync('dermacon2027_template.html', 'utf8');
  
  const startMarker = '<!-- SESSION_START -->';
  const endMarker = '<!-- SESSION_END -->';
  const startIndex = templateFile.indexOf(startMarker);
  const endIndex = templateFile.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    console.log('Error: Could not find SESSION_START/END markers in the template.');
    return;
  }

  const blockTemplate = templateFile.substring(startIndex + startMarker.length, endIndex);
  let sessionBlocksHtml = '';
  
  const formatTime = (t) => {
    if (!t) return '--:--';
    const parts = t.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] ? parts[1].substring(0, 2) : '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return h + ':' + m + ' ' + ampm;
  };

  const formatDate = (d) => {
    if (!d) return '--';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  facultyTopics.forEach((ft, index) => {
    const t = ft.session_topics;
    const ses = t ? t.conference_sessions : null;
    if (!ses) return;

    const coord = coordMap[ses.id] || { canonical_name: 'Scientific Committee', phone: '', email: '' };
    
    let block = blockTemplate;
    block = block.replace(/\{\{SessionNumber\}\}/g, String(index + 1));
    block = block.replace(/\{\{Topic\}\}/g, t.topic_title || '');
    block = block.replace(/\{\{Timing\}\}/g, formatTime(t.start_time) + ' – ' + formatTime(t.end_time));
    block = block.replace(/\{\{SessionName\}\}/g, ses.session_code + ' ' + ses.session_name);
    block = block.replace(/\{\{Hall\}\}/g, ses.hall || 'TBD');
    block = block.replace(/\{\{Date\}\}/g, formatDate(ses.session_date));
    block = block.replace(/\{\{SessionTime\}\}/g, formatTime(ses.start_time) + ' – ' + formatTime(ses.end_time));
    block = block.replace(/\{\{CoordName\}\}/g, coord.canonical_name || 'Scientific Committee');
    block = block.replace(/\{\{CoordPhone\}\}/g, coord.phone || '');
    block = block.replace(/\{\{CoordEmail\}\}/g, coord.email || '');
    
    sessionBlocksHtml += block;
  });

  let finalHtml = templateFile.substring(0, startIndex) + sessionBlocksHtml + templateFile.substring(endIndex + endMarker.length);

  finalHtml = finalHtml.replace(/\{\{FacultyName\}\}/g, f.canonical_name);
  finalHtml = finalHtml.replace(/\{\{Role\}\}/g, facultyTopics[0] ? facultyTopics[0].role : 'Faculty');
  finalHtml = finalHtml.replace(/\{\{LetterDate\}\}/g, new Date().toLocaleDateString('en-GB'));
  finalHtml = finalHtml.replace('https://forms.gle/REPLACE_WITH_YOUR_GOOGLE_FORM_LINK', '#');

  fs.writeFileSync('dr-uzzaif-real-data.html', finalHtml);
  console.log('Successfully generated dr-uzzaif-real-data.html');
  
  require('child_process').exec('start dr-uzzaif-real-data.html');
}

run();