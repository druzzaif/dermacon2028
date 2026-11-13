import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
FAC304	Dr Uzzaif Mansuri			druzzaifv@gmail.com
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
FAC272	Demo Faculty 272			demo.faculty.272@example.invalid			Faculty
FAC271	Demo Faculty 271			demo.faculty.271@example.invalid			Faculty
FAC270	Demo Faculty 270			demo.faculty.270@example.invalid			Coordinator
FAC269	Demo Faculty 269			demo.faculty.269@example.invalid
FAC268	Demo Faculty 268		IN	demo.faculty.268@example.invalid
FAC267	Demo Faculty 267		IN	demo.faculty.267@example.invalid
FAC266	Demo Faculty 266		IN	demo.faculty.266@example.invalid
FAC265	Demo Faculty 265		IN	demo.faculty.265@example.invalid
FAC264	Demo Faculty 264		IN	demo.faculty.264@example.invalid
FAC263	Demo Faculty 263		IN	demo.faculty.263@example.invalid
FAC262	Demo Faculty 262		IN	demo.faculty.262@example.invalid
FAC261	Demo Faculty 261		IN	demo.faculty.261@example.invalid
FAC260	Demo Faculty 260		IN	demo.faculty.260@example.invalid
FAC259	Demo Faculty 259		IN	demo.faculty.259@example.invalid
FAC258	Demo Faculty 258		IN	demo.faculty.258@example.invalid
FAC256	Demo Faculty 256		IN	demo.faculty.256@example.invalid
FAC255	Demo Faculty 255		IN	demo.faculty.255@example.invalid
FAC254	Demo Faculty 254		IN	demo.faculty.254@example.invalid
FAC253	Demo Faculty 253		IN	demo.faculty.253@example.invalid
FAC252	Demo Faculty 252		IN	demo.faculty.252@example.invalid
FAC251	Demo Faculty 251		IN	demo.faculty.251@example.invalid
FAC250	Demo Faculty 250		IN	demo.faculty.250@example.invalid
FAC249	Demo Faculty 249		IN	demo.faculty.249@example.invalid
FAC248	Demo Faculty 248		IN	demo.faculty.248@example.invalid
FAC247	Demo Faculty 247		IN	demo.faculty.247@example.invalid
FAC246	Demo Faculty 246		IN	demo.faculty.246@example.invalid
FAC245	Demo Faculty 245		IN	demo.faculty.245@example.invalid
FAC244	Demo Faculty 244		IN	demo.faculty.244@example.invalid
FAC243	Demo Faculty 243		IN	demo.faculty.243@example.invalid
FAC242	Demo Faculty 242		IN	demo.faculty.242@example.invalid
FAC241	Demo Faculty 241		IN	demo.faculty.241@example.invalid
FAC240	Demo Faculty 240		IN	demo.faculty.240@example.invalid
FAC239	Demo Faculty 239		IN	demo.faculty.239@example.invalid
FAC238	Demo Faculty 238		IN	demo.faculty.238@example.invalid
FAC237	Demo Faculty 237		IN	demo.faculty.237@example.invalid
FAC236	Demo Faculty 236		IN	demo.faculty.236@example.invalid
FAC235	Demo Faculty 235		IN	demo.faculty.235@example.invalid
FAC234	Demo Faculty 234		IN	demo.faculty.234@example.invalid
FAC233	Demo Faculty 233		IL	demo.faculty.233@example.invalid
FAC232	Demo Faculty 232		IN	demo.faculty.232@example.invalid
FAC231	Demo Faculty 231		IN	demo.faculty.231@example.invalid
FAC230	Demo Faculty 230		IN	demo.faculty.230@example.invalid
FAC229	Demo Faculty 229		IN	demo.faculty.229@example.invalid
FAC228	Demo Faculty 228		IN	demo.faculty.228@example.invalid
FAC227	Demo Faculty 227		IN	demo.faculty.227@example.invalid
FAC226	Demo Faculty 226		IN	demo.faculty.226@example.invalid
FAC225	Demo Faculty 225		IN	demo.faculty.225@example.invalid
FAC224	Demo Faculty 224		IN	demo.faculty.224@example.invalid
FAC223	Demo Faculty 223		IN	demo.faculty.223@example.invalid
FAC222	Demo Faculty 222		IN	demo.faculty.222@example.invalid
FAC221	Demo Faculty 221		IN	demo.faculty.221@example.invalid
FAC220	Demo Faculty 220		IN	demo.faculty.220@example.invalid
FAC219	Demo Faculty 219		IN	demo.faculty.219@example.invalid
FAC218	Demo Faculty 218		PL	demo.faculty.218@example.invalid
FAC217	Demo Faculty 217		ES	demo.faculty.217@example.invalid
FAC216	Demo Faculty 216		BR	demo.faculty.216@example.invalid
FAC215	Demo Faculty 215		IN	demo.faculty.215@example.invalid
FAC214	Demo Faculty 214		IN	demo.faculty.214@example.invalid
FAC213	Demo Faculty 213		IN	demo.faculty.213@example.invalid
FAC212	Demo Faculty 212		IN	demo.faculty.212@example.invalid
FAC211	Demo Faculty 211		IN	demo.faculty.211@example.invalid
FAC209	Demo Faculty 209		IN	demo.faculty.209@example.invalid
FAC208	Demo Faculty 208		IN	demo.faculty.208@example.invalid
FAC207	Demo Faculty 207		IN	demo.faculty.207@example.invalid
FAC206	Demo Faculty 206		IN	demo.faculty.206@example.invalid
FAC205	Demo Faculty 205		IN	demo.faculty.205@example.invalid
FAC204	Demo Faculty 204		IN	demo.faculty.204@example.invalid
FAC203	Demo Faculty 203		IT	demo.faculty.203@example.invalid
FAC202	Demo Faculty 202		SA	demo.faculty.202@example.invalid
FAC199	Demo Faculty 199		US	demo.faculty.199@example.invalid
FAC198	Demo Faculty 198		IN	demo.faculty.198@example.invalid
FAC197	Demo Faculty 197		US	demo.faculty.197@example.invalid
FAC196	Demo Faculty 196		IN	demo.faculty.196@example.invalid
FAC195	Demo Faculty 195		IN	demo.faculty.195@example.invalid
FAC194	Demo Faculty 194		IN	demo.faculty.194@example.invalid
FAC193	Demo Faculty 193		IN	demo.faculty.193@example.invalid
FAC192	Demo Faculty 192		IN	demo.faculty.192@example.invalid
FAC191	Demo Faculty 191		IN	demo.faculty.191@example.invalid
FAC190	Demo Faculty 190		IN	demo.faculty.190@example.invalid
FAC189	Demo Faculty 189		IN	demo.faculty.189@example.invalid
FAC188	Demo Faculty 188		IN	demo.faculty.188@example.invalid
FAC187	Demo Faculty 187		IN	demo.faculty.187@example.invalid
FAC186	Demo Faculty 186		IN	demo.faculty.186@example.invalid
FAC185	Demo Faculty 185		IN	demo.faculty.185@example.invalid
FAC184	Demo Faculty 184		IN	demo.faculty.184@example.invalid
FAC183	Demo Faculty 183		IN	demo.faculty.183@example.invalid
FAC182	Demo Faculty 182		IN	demo.faculty.182@example.invalid
FAC181	Demo Faculty 181		IN	demo.faculty.181@example.invalid
FAC180	Demo Faculty 180		IN	demo.faculty.180@example.invalid
FAC179	Demo Faculty 179		IN	demo.faculty.179@example.invalid
FAC178	Demo Faculty 178		IN	demo.faculty.178@example.invalid
FAC177	Demo Faculty 177		IN	demo.faculty.177@example.invalid
FAC176	Demo Faculty 176		IN	demo.faculty.176@example.invalid
FAC175	Demo Faculty 175		IN	demo.faculty.175@example.invalid
FAC174	Demo Faculty 174		IN	demo.faculty.174@example.invalid
FAC173	Demo Faculty 173		IN	demo.faculty.173@example.invalid
FAC172	Demo Faculty 172		IN	demo.faculty.172@example.invalid
FAC171	Demo Faculty 171		IN	demo.faculty.171@example.invalid
FAC170	Demo Faculty 170		IN	demo.faculty.170@example.invalid
FAC169	Demo Faculty 169		IN	demo.faculty.169@example.invalid
FAC168	Demo Faculty 168		IN	demo.faculty.168@example.invalid
FAC167	Demo Faculty 167		IN	demo.faculty.167@example.invalid
FAC166	Demo Faculty 166		IN	demo.faculty.166@example.invalid
FAC165	Demo Faculty 165		IN	demo.faculty.165@example.invalid
FAC164	Demo Faculty 164		IN	demo.faculty.164@example.invalid
FAC163	Demo Faculty 163		IN	demo.faculty.163@example.invalid
FAC162	Demo Faculty 162		IN	demo.faculty.162@example.invalid
FAC161	Demo Faculty 161		IN	demo.faculty.161@example.invalid
FAC160	Demo Faculty 160		IN	demo.faculty.160@example.invalid
FAC159	Demo Faculty 159		IN	demo.faculty.159@example.invalid
FAC158	Demo Faculty 158		IN	demo.faculty.158@example.invalid
FAC157	Demo Faculty 157		IN	demo.faculty.157@example.invalid
FAC156	Demo Faculty 156		IN	demo.faculty.156@example.invalid
FAC155	Demo Faculty 155		IN	demo.faculty.155@example.invalid
FAC154	Demo Faculty 154		IN	demo.faculty.154@example.invalid
FAC153	Demo Faculty 153		IN	demo.faculty.153@example.invalid
FAC152	Demo Faculty 152		IN	demo.faculty.152@example.invalid
FAC151	Demo Faculty 151		IN	demo.faculty.151@example.invalid
FAC150	Demo Faculty 150		IN	demo.faculty.150@example.invalid
FAC149	Demo Faculty 149		IN	demo.faculty.149@example.invalid
FAC148	Demo Faculty 148		IN	demo.faculty.148@example.invalid
FAC147	Demo Faculty 147		IN	demo.faculty.147@example.invalid
FAC145	Demo Faculty 145		IN	demo.faculty.145@example.invalid
FAC144	Demo Faculty 144		IN	demo.faculty.144@example.invalid
FAC143	Demo Faculty 143		IN	demo.faculty.143@example.invalid
FAC142	Demo Faculty 142		IN	demo.faculty.142@example.invalid
FAC141	Demo Faculty 141		IN	demo.faculty.141@example.invalid
FAC140	Demo Faculty 140		IN	demo.faculty.140@example.invalid
FAC139	Demo Faculty 139		IN	demo.faculty.139@example.invalid
FAC138	Demo Faculty 138		IN	demo.faculty.138@example.invalid
FAC137	Demo Faculty 137		IN	demo.faculty.137@example.invalid
FAC136	Demo Faculty 136		IN	demo.faculty.136@example.invalid
FAC135	Demo Faculty 135		IN	demo.faculty.135@example.invalid
FAC134	Demo Faculty 134		IN	demo.faculty.134@example.invalid
FAC133	Demo Faculty 133		IN	demo.faculty.133@example.invalid
FAC132	Demo Faculty 132		IN	demo.faculty.132@example.invalid
FAC131	Demo Faculty 131		IN	demo.faculty.131@example.invalid
FAC130	Demo Faculty 130		IN	demo.faculty.130@example.invalid
FAC129	Demo Faculty 129		IN	demo.faculty.129@example.invalid
FAC128	Demo Faculty 128		IN	demo.faculty.128@example.invalid
FAC127	Demo Faculty 127		IN	demo.faculty.127@example.invalid
FAC126	Demo Faculty 126		IN	demo.faculty.126@example.invalid
FAC125	Demo Faculty 125		IN	demo.faculty.125@example.invalid
FAC124	Demo Faculty 124		IN	demo.faculty.124@example.invalid
FAC123	Demo Faculty 123		IN	demo.faculty.123@example.invalid
FAC122	Demo Faculty 122		IN	demo.faculty.122@example.invalid
FAC121	Demo Faculty 121		IN	demo.faculty.121@example.invalid
FAC120	Demo Faculty 120		IN	demo.faculty.120@example.invalid
FAC119	Demo Faculty 119		IN	demo.faculty.119@example.invalid
FAC118	Demo Faculty 118		IN	demo.faculty.118@example.invalid
FAC117	Demo Faculty 117		IN	demo.faculty.117@example.invalid
FAC116	Demo Faculty 116		IN	demo.faculty.116@example.invalid
FAC115	Demo Faculty 115		IN	demo.faculty.115@example.invalid
FAC114	Demo Faculty 114		IN	demo.faculty.114@example.invalid
FAC113	Demo Faculty 113		IN	demo.faculty.113@example.invalid
FAC112	Demo Faculty 112		IN	demo.faculty.112@example.invalid
FAC111	Demo Faculty 111		IN	demo.faculty.111@example.invalid
FAC110	Demo Faculty 110		IN	demo.faculty.110@example.invalid
FAC109	Demo Faculty 109		IN	demo.faculty.109@example.invalid
FAC108	Demo Faculty 108		IN	demo.faculty.108@example.invalid
FAC107	Demo Faculty 107		IN	demo.faculty.107@example.invalid
FAC106	Demo Faculty 106		IN	demo.faculty.106@example.invalid
FAC105	Demo Faculty 105		SG	demo.faculty.105@example.invalid
FAC104	Demo Faculty 104		IN	demo.faculty.104@example.invalid
FAC103	Demo Faculty 103		IN	demo.faculty.103@example.invalid
FAC102	Demo Faculty 102		IN	demo.faculty.102@example.invalid
FAC101	Demo Faculty 101		IN	demo.faculty.101@example.invalid
FAC100	Demo Faculty 100		IN	demo.faculty.100@example.invalid
FAC099	Demo Faculty 099		IN	demo.faculty.099@example.invalid
FAC098	Demo Faculty 098		IN	demo.faculty.098@example.invalid
FAC097	Demo Faculty 097		IN	demo.faculty.097@example.invalid
FAC096	Demo Faculty 096		IN	demo.faculty.096@example.invalid
FAC095	Demo Faculty 095		IN	demo.faculty.095@example.invalid
FAC094	Demo Faculty 094		IN	demo.faculty.094@example.invalid
FAC093	Demo Faculty 093		IN	demo.faculty.093@example.invalid
FAC092	Demo Faculty 092		IN	demo.faculty.092@example.invalid
FAC091	Demo Faculty 091		IN	demo.faculty.091@example.invalid
FAC090	Demo Faculty 090		IN	demo.faculty.090@example.invalid
FAC089	Demo Faculty 089		UK	demo.faculty.089@example.invalid
FAC088	Demo Faculty 088		IN	demo.faculty.088@example.invalid
FAC087	Demo Faculty 087		IN	demo.faculty.087@example.invalid
FAC086	Demo Faculty 086		IN	demo.faculty.086@example.invalid
FAC085	Demo Faculty 085		IN	demo.faculty.085@example.invalid
FAC084	Demo Faculty 084		IN	demo.faculty.084@example.invalid
FAC083	Demo Faculty 083		IN	demo.faculty.083@example.invalid
FAC082	Demo Faculty 082		IN	demo.faculty.082@example.invalid
FAC081	Demo Faculty 081		IN	demo.faculty.081@example.invalid
FAC080	Demo Faculty 080		IN	demo.faculty.080@example.invalid
FAC079	Demo Faculty 079		IN	demo.faculty.079@example.invalid
FAC078	Demo Faculty 078		IN	demo.faculty.078@example.invalid
FAC077	Demo Faculty 077		IN	demo.faculty.077@example.invalid
FAC076	Demo Faculty 076		IN	demo.faculty.076@example.invalid
FAC075	Demo Faculty 075		IN	demo.faculty.075@example.invalid
FAC074	Demo Faculty 074		IN	demo.faculty.074@example.invalid
FAC073	Demo Faculty 073		IN	demo.faculty.073@example.invalid
FAC072	Demo Faculty 072		IN	demo.faculty.072@example.invalid
FAC071	Demo Faculty 071		IN	demo.faculty.071@example.invalid
FAC070	Demo Faculty 070		IN	demo.faculty.070@example.invalid
FAC069	Demo Faculty 069		IN	demo.faculty.069@example.invalid
FAC068	Demo Faculty 068		IN	demo.faculty.068@example.invalid
FAC067	Demo Faculty 067		IN	demo.faculty.067@example.invalid
FAC066	Demo Faculty 066		IN	demo.faculty.066@example.invalid
FAC065	Demo Faculty 065		IN	demo.faculty.065@example.invalid
FAC064	Demo Faculty 064		IN	demo.faculty.064@example.invalid
FAC063	Demo Faculty 063		IN	demo.faculty.063@example.invalid
FAC062	Demo Faculty 062		IN	demo.faculty.062@example.invalid
FAC061	Demo Faculty 061		IN	demo.faculty.061@example.invalid
FAC060	Demo Faculty 060		IN	demo.faculty.060@example.invalid
FAC059	Demo Faculty 059		INTL	demo.faculty.059@example.invalid
FAC058	Demo Faculty 058		IN	demo.faculty.058@example.invalid
FAC057	Demo Faculty 057		IN	demo.faculty.057@example.invalid
FAC056	Demo Faculty 056		IN	demo.faculty.056@example.invalid
FAC055	Demo Faculty 055		IN	demo.faculty.055@example.invalid
FAC054	Demo Faculty 054		IN	demo.faculty.054@example.invalid
FAC053	Demo Faculty 053		IN	demo.faculty.053@example.invalid
FAC052	Demo Faculty 052		IN	demo.faculty.052@example.invalid
FAC051	Demo Faculty 051		IN	demo.faculty.051@example.invalid
FAC050	Demo Faculty 050		IN	demo.faculty.050@example.invalid
FAC049	Demo Faculty 049		IN	demo.faculty.049@example.invalid
FAC048	Demo Faculty 048		IN	demo.faculty.048@example.invalid
FAC047	Demo Faculty 047		IN	demo.faculty.047@example.invalid
FAC046	Demo Faculty 046		IN	demo.faculty.046@example.invalid
FAC045	Demo Faculty 045		IN	demo.faculty.045@example.invalid
FAC044	Demo Faculty 044		IN	demo.faculty.044@example.invalid
FAC043	Demo Faculty 043		IN	demo.faculty.043@example.invalid
FAC042	Demo Faculty 042		IN	demo.faculty.042@example.invalid
FAC041	Demo Faculty 041		IN	demo.faculty.041@example.invalid
FAC040	Demo Faculty 040		IN	demo.faculty.040@example.invalid
FAC039	Demo Faculty 039		IN	demo.faculty.039@example.invalid
FAC038	Demo Faculty 038		IN	demo.faculty.038@example.invalid
FAC037	Demo Faculty 037		IN	demo.faculty.037@example.invalid
FAC036	Demo Faculty 036		IN	demo.faculty.036@example.invalid
FAC035	Demo Faculty 035		IN	demo.faculty.035@example.invalid
FAC034	Demo Faculty 034		IN	demo.faculty.034@example.invalid
FAC033	Demo Faculty 033		IN	demo.faculty.033@example.invalid
FAC032	Demo Faculty 032		IN	demo.faculty.032@example.invalid
FAC031	Demo Faculty 031		IN	demo.faculty.031@example.invalid
FAC030	Demo Faculty 030		IN	demo.faculty.030@example.invalid
FAC029	Demo Faculty 029		IN	demo.faculty.029@example.invalid
FAC028	Demo Faculty 028		IN	demo.faculty.028@example.invalid
FAC027	Demo Faculty 027		IN	demo.faculty.027@example.invalid
FAC026	Demo Faculty 026		IN	demo.faculty.026@example.invalid
FAC025	Demo Faculty 025		IN	demo.faculty.025@example.invalid
FAC024	Demo Faculty 024		IN	demo.faculty.024@example.invalid
FAC023	Demo Faculty 023		IN	demo.faculty.023@example.invalid
FAC021	Demo Faculty 021		IN	demo.faculty.021@example.invalid
FAC020	Demo Faculty 020		IN	demo.faculty.020@example.invalid
FAC019	Demo Faculty 019		IN	demo.faculty.019@example.invalid
FAC018	Demo Faculty 018		IN	demo.faculty.018@example.invalid
FAC017	Demo Faculty 017		IN	demo.faculty.017@example.invalid
FAC016	Demo Faculty 016		IN	demo.faculty.016@example.invalid
FAC015	Demo Faculty 015		IN	demo.faculty.015@example.invalid
FAC014	Demo Faculty 014		IN	demo.faculty.014@example.invalid
FAC013	Demo Faculty 013		IN	demo.faculty.013@example.invalid
FAC012	Demo Faculty 012		IN	demo.faculty.012@example.invalid
FAC011	Demo Faculty 011		IN	demo.faculty.011@example.invalid
FAC010	Demo Faculty 010		IN	demo.faculty.010@example.invalid
FAC009	Demo Faculty 009		IN	demo.faculty.009@example.invalid
FAC008	Demo Faculty 008		IN	demo.faculty.008@example.invalid
FAC007	Demo Faculty 007		IN	demo.faculty.007@example.invalid
FAC006	Demo Faculty 006		IN	demo.faculty.006@example.invalid
FAC005	Demo Faculty 005		IN	demo.faculty.005@example.invalid
FAC004	Demo Faculty 004		IN	demo.faculty.004@example.invalid
FAC003	Demo Faculty 003		IN	demo.faculty.003@example.invalid
FAC002	Demo Faculty 002		IN	demo.faculty.002@example.invalid
FAC001	Dr Uzzaif Mansuri	9825878228	IN	druzzaif@gmail.com
`;

async function importData() {
  console.log("Starting full import...");
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
      // Ignore duplicate emails/IDs
      if (error.code !== '23505') { 
        console.error(`❌ Error on ${faculty_id}:`, error.message);
        errorCount++;
      }
    } else {
      successCount++;
    }
  }

  console.log(`\n🎉 Full Import Complete!`);
  console.log(`✅ Inserted: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

importData();