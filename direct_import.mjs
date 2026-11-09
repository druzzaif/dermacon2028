import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
FAC304	druzzaifv			druzzaifv@gmail.com
FAC303	Dr Aarti Shah			dr.aarti29@gmail.com
FAC302	Dr Nausheen Khan	9773613631	IN	doc_nausheen@yahoo.com
FAC301	Dr Pooja Patel	8306330281	IN	poojappatel2395@gmail.com
FAC300	Dr A.V. Kaleeswaran	9442569301		kaleesderm@gmail.om
FAC299	Dr Dinesh Kumar	9786492927		drdinesh1512@gmail.com
FAC298	Dr Prima Dalwadi	7984241845		primadalwadi@gmail.com
FAC297	Dr Kanchan Srivastava	7905175683	IN	drkanchanderma@gmail.com
FAC296	Dr Anil Dashore	9827274246	IN	dr.dashoreanil@gmail.com
FAC295	Dr Suruchi Garg	9914253530	IN	gargsuruchi01@gmail.com
FAC294	Dr Ekta Sahu	9920591779	IN	
FAC293	Dr Ruru Pamela			ruripamela@gmail.com
FAC292	Dr Diwaker Sharma		IN	
FAC291	Dr Khushbu Chauhan	8866879682	IN	khushbuchauhan37@gmail.com
FAC290	Dr Anastasia Georgievskaya	(807) 698-8400	Canada	nastya@haut.ai
FAC289	Dr Manu Jain	1-646-888-6109	US	jainm@mskcc.org
FAC288	Dr Monisha Madhumita	8884440655		drmonishamadhumita@gmail.com
FAC287	Dr Siddharth Bhatt	8469938871	IN	sidbhatt.noida@gmail.com
FAC286	Dr Bhavni Oberoi	7407424758	IN	bhavni.oberoi@gmail.com
FAC285	Dr Rochelle Monteiro	9739315324	IN	rochelle.cheryl@gmail.com
FAC284	Dr Surajit Goral	9614506569		dragorai@gmail.com
FAC001	Dr Uzzaif Mansuri	9825878228	IN	druzzaif@gmail.com
FAC002	Dr Aniruddha Ghosh	8697354467	IN	dr.ani.ghosh@gmail.com
FAC003	Dr Syed Mubashir	9697343464	IN	syedmubashir2006@gmail.com
FAC004	Dr Harish Prasad	9738389028	IN	harish.harris@gmail.com
FAC005	Dr Saurabh Singh	9968024250	IN	saurabhdoc@yahoo.co.in
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