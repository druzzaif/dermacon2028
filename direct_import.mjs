import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
FAC304	druzzaifv			druzzaifv@gmail.com
FAC303	Demo Faculty 303			demo.faculty.303@example.invalid
FAC302	Demo Faculty 302		IN	demo.faculty.302@example.invalid
FAC301	Demo Faculty 301		IN	demo.faculty.301@example.invalid
FAC300	Demo Faculty 300			demo.faculty.300@example.invalid
FAC299	Demo Faculty 299			demo.faculty.299@example.invalid
FAC298	Demo Faculty 298			demo.faculty.298@example.invalid
FAC297	Demo Faculty 297		IN	demo.faculty.297@example.invalid
FAC296	Demo Faculty 296		IN	demo.faculty.296@example.invalid
FAC295	Demo Faculty 295		IN	demo.faculty.295@example.invalid
FAC294	Demo Faculty 294		IN	demo.faculty.294@example.invalid
FAC293	Demo Faculty 293			demo.faculty.293@example.invalid
FAC292	Demo Faculty 292		IN	demo.faculty.292@example.invalid
FAC291	Demo Faculty 291		IN	demo.faculty.291@example.invalid
FAC290	Demo Faculty 290		Canada	demo.faculty.290@example.invalid
FAC289	Demo Faculty 289		US	demo.faculty.289@example.invalid
FAC288	Demo Faculty 288			demo.faculty.288@example.invalid
FAC287	Demo Faculty 287		IN	demo.faculty.287@example.invalid
FAC286	Demo Faculty 286		IN	demo.faculty.286@example.invalid
FAC285	Demo Faculty 285		IN	demo.faculty.285@example.invalid
FAC284	Demo Faculty 284			demo.faculty.284@example.invalid
FAC001	Dr Uzzaif Mansuri	9825878228	IN	druzzaif@gmail.com
FAC002	Demo Faculty 002		IN	demo.faculty.002@example.invalid
FAC003	Demo Faculty 003		IN	demo.faculty.003@example.invalid
FAC004	Demo Faculty 004		IN	demo.faculty.004@example.invalid
FAC005	Demo Faculty 005		IN	demo.faculty.005@example.invalid
`;

async function importData() {
  console.log("Starting direct import to Supabase...");
  let successCount = 0;
  let errorCount = 0;

  const lines = rawData.trim().split('\n');

  for (const line of lines) {
    const parts = line.split('\t');
    
    const faculty_id = parts[0]?.trim();
    const canonical_name = parts[1]?.trim();
    const phone = parts[2]?.trim() || null;
    const country = parts[3]?.trim() || null;
    const email = parts[4]?.trim() || null;

    if (!faculty_id || !faculty_id.startsWith('FAC')) continue;

    let first_name = canonical_name;
    let last_name = null;
    
    if (canonical_name && canonical_name.includes(' ')) {
      const nameParts = canonical_name.split(' ');
      if (nameParts[0] === 'Dr' || nameParts[0] === 'Dr.') {
        first_name = nameParts.slice(0, 2).join(' '); 
        last_name = nameParts.slice(2).join(' ') || null;
      } else {
        first_name = nameParts[0];
        last_name = nameParts.slice(1).join(' ') || null;
      }
    }

    const payload = {
      faculty_id,
      canonical_name,
      first_name,
      last_name,
      email: email || `no-email-${faculty_id}@placeholder.com`,
      phone,
      country,
      is_active: true
    };

    const { error } = await supabase.from('faculty').insert(payload);

    if (error) {
      console.error(`❌ Error on ${faculty_id}:`, error.message);
      errorCount++;
    } else {
      successCount++;
      console.log(`✅ Added ${canonical_name}`);
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`✅ Inserted: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

importData();