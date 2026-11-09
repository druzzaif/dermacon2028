import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

// This is the exact raw text from your topics_export.csv
const rawData = `
MC1	1	FAC027
MC1	2	FAC231
MC1	2	FAC181
MC1	3	FAC232
MC1	4	FAC228
MC1	5	FAC142
MC1	6	FAC144
MC1	7	FAC168
MC1	8	FAC140
MC1	9	FAC171
MC1	10	FAC232
MC10	1	FAC244
MC10	2	FAC244
MC10	3	FAC251
MC10	4	FAC092
MC10	5	FAC244
MC10	6	FAC134
MC10	7	FAC251
MC10	8	FAC250
MC10	9	FAC134
MC10	10	FAC254
MC10	11	FAC244
MC11	1	FAC099
MC11	2	FAC177
MC11	3	FAC249
MC11	4	FAC250
MC11	5	FAC251
MC12	1	FAC229
MC12	2	FAC301
MC12	3	FAC229
MC12	4	FAC301
MC2	1	FAC177
MC2	2	FAC000
MC2	3	FAC177
MC2	4	FAC000
MC3	1	FAC135
MC3	2	FAC033
MC3	3	FAC136
MC3	4	FAC130
MC4	1	FAC149
MC4	2	FAC231
MC4	3	FAC149
MC4	4	FAC231
MC5	1	FAC242
MC5	2	FAC234
MC5	3	FAC242
MC5	4	FAC234
MC6	1	FAC135
MC6	2	FAC253
MC6	3	FAC291
MC6	4	FAC292
MC6	5	FAC188
MC7	1	FAC244
MC7	2	FAC134
MC7	3	FAC250
MC7	4	FAC251
MC7	5	FAC254
MC7	6	FAC117
MC8	1	FAC099
MC8	2	FAC134
MC8	3	FAC177
MC9	1	FAC227
MC9	2	FAC166
MC9	3	FAC198
WS1	1	FAC016
WS1	2	FAC018
WS1	3	FAC030
WS1	4	FAC246
WS1	5	FAC247
WS1	6	FAC255
WS1	7	FAC256
WS1	8	FAC007
WS10	1	FAC136
WS10	2	FAC260
WS10	3	FAC269
WS11	1	FAC001
WS11	2	FAC003
WS12	1	FAC262
WS12	2	FAC137
WS12	3	FAC263
WS13	1	FAC051
WS13	2	FAC052
WS14	1	FAC085
WS14	2	FAC074
WS15	1	FAC029
WS15	2	FAC061
WS16	1	FAC245
WS16	2	FAC064
WS17	1	FAC099
WS17	2	FAC134
WS17	3	FAC177
WS17	4	FAC090
WS18	1	FAC136
WS18	2	FAC260
WS18	3	FAC084
WS19	1	FAC099
WS19	2	FAC134
WS19	3	FAC177
WS19	4	FAC241
WS19	5	FAC129
WS2	1	FAC081
WS2	2	FAC083
WS2	3	FAC095
WS2	4	FAC100
WS2	5	FAC036
WS20	1	FAC136
WS20	2	FAC250
WS20	3	FAC298
WS21	1	FAC244
WS21	2	FAC254
WS22	1	FAC242
WS23	1	FAC229
WS23	2	FAC166
WS23	3	FAC227
WS23	4	FAC301
WS24	1	FAC241
WS25	1	FAC149
WS25	2	FAC145
WS25	3	FAC243
WS25	4	FAC252
WS25	5	FAC124
WS26	1	FAC018
WS26	2	FAC024
WS27	1	FAC227
WS27	2	FAC166
WS27	3	FAC229
WS27	4	FAC171
WS28	1	FAC040
WS28	2	FAC243
WS28	3	FAC155
WS29	1	FAC158
WS29	2	FAC085
WS29	3	FAC265
WS29	4	FAC157
WS3	1	FAC016
WS3	2	FAC018
WS3	3	FAC030
WS3	4	FAC099
WS3	5	FAC255
WS3	6	FAC256
WS3	7	FAC014
WS30	1	FAC097
WS30	2	FAC100
WS30	3	FAC134
WS30	4	FAC248
WS30	5	FAC266
WS31	1	FAC033
WS31	2	FAC267
WS31	3	FAC268
WS31	4	FAC125
WS32	1	FAC097
WS32	2	FAC100
WS32	3	FAC134
WS32	4	FAC248
WS32	5	FAC270
WS33	1	FAC304
WS33	2	FAC001
WS4	1	FAC083
WS4	2	FAC081
WS4	3	FAC095
WS4	4	FAC100
WS4	5	FAC084
WS5	1	FAC016
WS5	2	FAC018
WS5	3	FAC030
WS5	4	FAC246
WS5	5	FAC255
WS5	6	FAC256
WS5	7	FAC023
WS6	1	FAC083
WS6	2	FAC081
WS6	3	FAC095
WS6	4	FAC100
WS6	5	FAC094
WS7	1	FAC016
WS7	2	FAC018
WS7	3	FAC030
WS7	4	FAC099
WS7	5	FAC246
WS7	6	FAC255
WS7	7	FAC256
WS7	8	FAC015
WS8	1	FAC258
WS8	2	FAC104
WS9	1	FAC096
WS9	2	FAC259
WS9	3	FAC050
`;

async function ultimateFix() {
  console.log("Starting Ultimate Fix...");

  const { data: faculty } = await supabase.from('faculty').select('id, faculty_id');
  const { data: sessions } = await supabase.from('conference_sessions').select('id, session_code');
  const { data: topics } = await supabase.from('session_topics').select('id, session_id, sequence_no');

  const facultyMap = {};
  faculty?.forEach(f => { if (f.faculty_id) facultyMap[f.faculty_id.trim().toUpperCase()] = f.id; });

  const sessionMap = {};
  sessions?.forEach(s => { sessionMap[s.session_code.trim().toUpperCase()] = s.id; });

  const lines = rawData.trim().split('\n');
  let linkedCount = 0;

  // Clear old links first to start fresh
  await supabase.from('faculty_topics').delete().neq('faculty_id', '00000000-0000-0000-0000-000000000000');

  for (const line of lines) {
    const parts = line.split(/\s+/); // Splits by spaces or tabs
    if (parts.length < 3) continue;

    const sessionCode = parts[0].trim().toUpperCase();
    const seqNo = parseInt(parts[1]);
    const facultyCode = parts[2].trim().toUpperCase();

    const session_uuid = sessionMap[sessionCode];
    const faculty_uuid = facultyMap[facultyCode];

    if (!session_uuid || !faculty_uuid) continue;

    // Find topic exactly by session and sequence number
    const matchedTopic = topics.find(t => t.session_id === session_uuid && t.sequence_no === seqNo);

    if (matchedTopic) {
      const { error } = await supabase
        .from('faculty_topics')
        .insert({
          faculty_id: faculty_uuid,
          topic_id: matchedTopic.id,
          role: 'Faculty' // Default role, we can update Coordinators later if needed
        });
      
      if (!error) linkedCount++;
    }
  }

  console.log(`🎉 Done! Re-linked ${linkedCount} topics to their faculty.`);
}

ultimateFix();
