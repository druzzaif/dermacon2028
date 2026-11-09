import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
MC1	MasterClass	04-02-2027	Thursday	Dermal Fillers - Advanced	09:30 AM	01:00 PM	B1
MC10	MasterClass	04-02-2027	Thursday	Threads - Advanced	02:00 PM	05:30 PM	C1
MC11	MasterClass	04-02-2027	Thursday	Boosters	02:00 PM	05:30 PM	C2
MC12	MasterClass	04-02-2027	Thursday	Regenerative Medicine II	02:00 PM	05:30 PM	C3
MC2	MasterClass	04-02-2027	Thursday	Botulinum Toxin - Basic	09:30 AM	01:00 PM	B2
MC3	MasterClass	04-02-2027	Thursday	Non-Surgical Hair Restoration	09:30 AM	01:00 PM	B3
MC4	MasterClass	04-02-2027	Thursday	Botulinum Toxin - Advanced	02:00 PM	05:30 PM	B1
MC5	MasterClass	04-02-2027	Thursday	Dermal Fillers - Basic	02:00 PM	05:30 PM	B2
MC6	MasterClass	04-02-2027	Thursday	Hair Transplant	02:00 PM	05:30 PM	B3
MC7	MasterClass	04-02-2027	Thursday	Biostimulators & Bioremodelers	09:30 AM	01:00 PM	C1
MC8	MasterClass	04-02-2027	Thursday	Threads - Basic	09:30 AM	01:00 PM	C2
MC9	MasterClass	04-02-2027	Thursday	Regenerative Medicine I	09:30 AM	01:00 PM	C3
WS1	Workshop	04-02-2027	Thursday	Laser LHR	09:00 AM	11:00 AM	E1
WS10	Workshop	04-02-2027	Thursday	Platelet Rich Plasma (PRP)	09:00 AM	11:00 AM	E4
WS11	Workshop	04-02-2027	Thursday	Dermatosurgery: Essential Suturing & Instrumentation - Hands-on on Silicone Pad	11:30 AM	01:30 PM	E3
WS12	Workshop	04-02-2027	Thursday	Artificial Intelligence and Robotics	11:30 AM	01:30 PM	
WS13	Workshop	04-02-2027	Thursday	Acne Scar Surgery	02:00 PM	04:00 PM	E3
WS14	Workshop	04-02-2027	Thursday	Nail Surgery	02:00 PM	04:00 PM	E4
WS15	Workshop	04-02-2027	Thursday	Vitiligo Surgery	04:15 PM	06:15 PM	E3
WS16	Workshop	04-02-2027	Thursday	Scars & Keloids	04:15 PM	06:15 PM	E4
WS17	Workshop	05-02-2027	Friday	Neck Rejuvenation	02:00 PM	04:00 PM	E1
WS18	Workshop	05-02-2027	Friday	Phototherapy	02:00 PM	04:00 PM	E2
WS19	Workshop	05-02-2027	Friday	Lip Rejuvenation	02:00 PM	04:00 PM	E1
WS2	Workshop	04-02-2027	Thursday	Office Procedures 1: Patch Test, ASST, Biopsy, LA, Dressing, Smear, Emergencies	09:00 AM	11:00 AM	E2
WS20	Workshop	05-02-2027	Friday	Chemical Peels	02:00 PM	04:00 PM	E2
WS21	Workshop	05-02-2027	Friday	Feminine Rejuvenation	02:00 PM	04:00 PM	E3
WS22	Workshop	05-02-2027	Friday	Medifacial	02:00 PM	04:00 PM	E4
WS23	Workshop	05-02-2027	Friday	Non-Surgical Rhinoplasty	02:00 PM	04:00 PM	E3
WS24	Workshop	05-02-2027	Friday	Microblading	02:00 PM	04:00 PM	E4
WS25	Workshop	06-02-2027	Saturday	Periorbital Rejuvenation	02:00 PM	04:00 PM	E1
WS26	Workshop	06-02-2027	Saturday	Complications in Aesthetics & Laser	02:00 PM	04:00 PM	E2
WS27	Workshop	06-02-2027	Saturday	Hand Rejuvenation	02:00 PM	04:00 PM	E1
WS28	Workshop	06-02-2027	Saturday	Dermoscopy Unplugged: Expert Insights and Challenging Cases	04:15 PM	06:15 PM	E2
WS29	Workshop	06-02-2027	Saturday	Procedural Mx - Facial Melanosis	02:00 PM	04:00 PM	E3
WS3	Workshop	04-02-2027	Thursday	Laser 2 (Pigmentary Lasers)	11:30 AM	01:30 PM	E1
WS30	Workshop	06-02-2027	Saturday	Practice Management 1: Operational Efficiency & Business Management	02:00 PM	04:00 PM	E4
WS31	Workshop	06-02-2027	Saturday	Perioral Rejuvenation Workshop	04:15 PM	04:00 PM	E3
WS32	Workshop	06-02-2027	Saturday	Practice Management 2: Clinical Governance & Patient Safety	02:00 PM	04:00 PM	E4
WS33	Workshop	02-02-2027	Friday	Uzzaif Rejuvenation	02:00 PM	04:00 PM	E4
WS4	Workshop	04-02-2027	Thursday	Office Procedures 2: Cryotherapy, RF Hemostasis, Corn, Comedone, Wart, I/L, Pinhole Ablation	11:30 AM	01:30 PM	E2
WS5	Workshop	04-02-2027	Thursday	Laser EBD	02:00 PM	04:00 PM	E1
WS6	Workshop	04-02-2027	Thursday	Office Procedures 3: Microneedling, Subcision, Fat Transfer, Circumcision, Electrolysis, Lipolytics, Sclerotherapy	02:00 PM	04:00 PM	E2
WS7	Workshop	04-02-2027	Thursday	Laser 4 (Resurfacing Laser)	04:15 PM	06:15 PM	E1
WS8	Workshop	04-02-2027	Thursday	Dermatopathology	04:15 PM	06:15 PM	E2
WS9	Workshop	04-02-2027	Thursday	Basics of Dermatosurgery	09:00 AM	11:00 AM	E3
`;

// Helper to convert DD-MM-YYYY to YYYY-MM-DD
function formatDate(dateStr) {
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return null;
}

// Helper to convert 09:30 AM to 09:30:00
function formatTime(timeStr) {
  if (!timeStr || timeStr.trim() === '') return null;
  const [time, modifier] = timeStr.trim().split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
  return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
}

async function importSessions() {
  console.log("Starting session import...");
  let successCount = 0;
  let errorCount = 0;

  const lines = rawData.trim().split('\n');

  for (const line of lines) {
    const parts = line.split('\t');
    
    const session_code = parts[0]?.trim();
    if (!session_code) continue;

    const payload = {
      session_code: session_code,
      session_type: parts[1]?.trim() || null,
      session_date: formatDate(parts[2]),
      session_name: parts[4]?.trim() || 'Unnamed Session',
      start_time: formatTime(parts[5]),
      end_time: formatTime(parts[6]),
      hall: parts[7]?.trim() || null
    };

    const { error } = await supabase.from('conference_sessions').insert(payload);

    if (error) {
      if (error.code !== '23505') {
        console.error(`❌ Error on ${session_code}:`, error.message);
        errorCount++;
      }
    } else {
      successCount++;
    }
  }

  console.log(`\n🎉 Done!`);
  console.log(`✅ Inserted Sessions: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

importSessions();