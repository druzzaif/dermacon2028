import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imiwsxwlplbgrbwwzdsz.supabase.co';
const supabaseKey = 'sb_publishable_Lq081Sod43M2X950b5Zrxg_DKKcLuzF';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = `
FAC304	Dr Uzzaif Mansuri			druzzaifv@gmail.com
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
FAC272	Dr						Faculty
FAC271	Dr Krina Patel						Faculty
FAC270	Dr Manish Gautam						Coordinator
FAC269	Dr Rutvi Pandya	9638372788		rutvipandya96@gmail.com
FAC268	Dr Tejanshu Dalal	9601155050	IN	tejansu.dalal.td@gmail.com
FAC267	Dr Avani Shah	9819827373	IN	avaninilen@gmail.com
FAC266	Dr Rohit Batra		IN	
FAC265	Dr Malhar Shah	7698009828	IN	drmalharshah@gmail.com
FAC264	Dr Nishi Trivedi	9429100286	IN	nishi.trivedi04@gmail.com
FAC263	Dr Smit Thakkar	7878278782	IN	smit.smile0509@gmail.com
FAC262	Dr Ruchir Shah	9978241941	IN	rmb311@gmail.com
FAC261	Dr Kaksha Shah	9157307111	IN	kakshashah89@yahoo.co.in
FAC260	Dr Gopika Patel	9724546909	IN	gopipatel14496@gmail.com
FAC259	Dr Nilesh Katrodiya	9879456118	IN	patelnil27@gmail.com
FAC258	Dr Nayan Patel	9925011309	IN	patelnayan78.np@gmail.com
FAC256	Dr Hamir Kambariya	9978306304	IN	harsh.kmb@gmail.com
FAC255	Dr Gautam Vekariya	9825494648	IN	gautamvekariya28@gmail.com
FAC254	Dr Dhwani Vakta Shah	9879193322	IN	dhwanivakta@gmail.com
FAC253	Dr Anchal Jindal	9727056303	IN	drjindal28@gmail.com
FAC252	Dr Poojan Parikh	8141208582	IN	poojan47@yahoo.com
FAC251	Dr Jikisha Jain	9828321774	IN	jikisha9@icloud.com
FAC250	Dr Kajol Prithiani	9137033333	IN	kajolprithiani77@gmail.com
FAC249	Dr Naisargi Patel	9409531951	IN	patelnaisargi48@gmail.com
FAC248	Dr Kautuk Patel	9898367406	IN	patelkautukaiims1@gmail.com
FAC247	Dr Ritu Sureja	9925544332	IN	rbsureja@gmail.com
FAC246	Dr Pradipsinh Parmar	7201073928	IN	parmarpradipsinhd@gmail.com
FAC245	Dr Nitin Chhatraliya	9427493314	IN	iadvlgsb2024@gmail.com
FAC244	Dr Purva Bhambhani	8980008193	IN	drpurvabhambhani@gmail.com
FAC243	Dr Foram Pathak	9712966889	IN	drforampathak@gmail.com
FAC242	Dr Khyati Vasavada	9727779166	IN	drkhyativasavada@gmail.com
FAC241	Dr Pooja Koyani	9687628362	IN	koyanipooja@gmail.com
FAC240	Dr Bansari Hirpara	8320415536	IN	bansihirapara261992@gmail.com
FAC239	Dr Rashmi Jindal	9639657109	IN	rashmijundak98@gmail.com
FAC238	Dr Rajesh Nair	9037348618	IN	rajeshskincaremed@gmail.com
FAC237	Dr Anirban Ghosh	9830419625	IN	dranirbanderma@gmail.com
FAC236	Dr Ismail Sheikh	7028080600	IN	dermis1@gmail.com
FAC235	Dr Elangbam Nelson Singh	8302236044	IN	smsderma2014@gmail.com
FAC234	Dr Ishad Agarwal	8100622846	IN	ishad1984@gmail.com
FAC233	Dr Marina Landau	+972 99505151	IL	marinalandau@gmail.com
FAC232	Dr Malavika Kohli	9821024808	IN	malavikakohli@gmail.com
FAC231	Dr Pankaj Chaturvedi	9971228888	IN	drpankaj@medlinks.in
FAC230	Dr Padma Surapenni	9848360000	IN	padmavathiderma@gmail.com
FAC229	Dr Ami Shah	9825425867	IN	dramishah1@gmail.com
FAC228	Dr Kalpana Sarangi	9820188903	IN	drkalpanads@gmail.com
FAC227	Dr Geeta Patel	9825973103	IN	drgeeta@skinworld.co.in
FAC226	Dr Satish Bhatia	9820413312	IN	dermdestination@gmail.com
FAC225	Dr Isha Arora	9899773384	IN	drishaarora@gmail.com
FAC224	Dr Nikhil Singh	9520847220	IN	drnikhilsingh.derma@gmail.com
FAC223	Dr Sachin Varma	9830202395	IN	varmasachin@hotmail.com
FAC222	Dr Nitin Jain	8446886007	IN	drnitinjain@gmail.com
FAC221	Dr Nilesh Goyal	9769998696	IN	getyoung@juvenis.in
FAC220	Dr Dhanraj Chavan	8692999088	IN	drdhanrajchavan@gmail.com
FAC219	Dr Karishma Balani	9890028380	IN	drkarishmabalani@yahoo.com
FAC218	Dr Lidia Rudnicka	+48 225081450	PL	lidia.rudnicka@wum.edu.pl
FAC217	Dr Ramon Grimalt	+34 934308003	ES	ramongrimalt@ub.edu
FAC216	Dr Rodrigo Pirmez	+55 2125379976	BR	rodrigopirmez@gmail.com
FAC215	Dr Narendra Patwardhan	9822057712	IN	ngpatwardhan@gmail.com
FAC214	Dr Patrick Yesudian	+91 4428272526	IN	p_yesudian@hotmail.com
FAC213	Dr Rasya Dixit	9449404650	IN	dr.rasya@gmail.com
FAC212	Dr Bhavini Lodaya	9821079792	IN	bhavinilodaya1204@gmail.com
FAC211	Dr Rickson Pereira	9833183554	IN	dr.rickson@gmail.com
FAC209	Dr Gaurang Krishna	9999148940	IN	drgaurang@medlinks.in
FAC208	Dr Shekhar Neema	9830032821	IN	shekharadvait@gmail.com
FAC207	Dr Biju Vasudevan	9741290425	IN	biju.deepa@rediffmail.com
FAC206	Dr Rachita Dhurat	9870390057	IN	drrachitadhurat@gmail.com
FAC205	Dr Sandeep Arora	9910411635	IN	aroraderma@gmail.com
FAC204	Dr Sowmya Dogiparthi	9840753698	IN	sowmy88688@gmail.com
FAC203	Dr Bianca Maria Piraccini	+39 0512141111	IT	biancamaria.piraccini@unibo.it
FAC202	Dr Ruaa Alharithy	+966 114670011	SA	alharithyruaa@gmail.com
FAC199	Dr Carlos Wambier	+1 401 444 4000	US	carlos_wambier@brown.edu
FAC198	Dr Gulhima Arora	8826041678	IN	gulhima@gmail.com
FAC197	Dr Shilpi Kheterpal	+1 216 444 2200	US	khetars@ccf.org
FAC196	Dr Amrendra Kumar	9899716441	IN	dr.amrendra07@gmail.com
FAC195	Dr Neha Taneja	9179179605	IN	taneja.neha2908@gmail.com
FAC194	Dr Amit Kerure	9619766139	IN	amikerure@gmail.com
FAC193	Dr Megha Tandon	7408417111	IN	tan.megha1993@gmail.com
FAC192	Dr Ajara Sayyad	9022304400	IN	drtabassumsayyad@gmail.com
FAC191	Dr BL Jangid	9899557272	IN	drjangid@gmail.com
FAC190	Dr Amit Bhatt	9825635322	IN	bhattamit31@gmail.com
FAC189	Dr John Watts	9490727091	IN	hairdj@live.in
FAC188	Dr Kavish Chouhan	8588861092	IN	kavish_chouhan@yahoo.com
FAC187	Dr Niranjana Raj	9620061409	IN	niranjana.ycdc@gmail.com
FAC186	Dr Prashant Agarwal	8890444433	IN	drprashantagarwal111@gmail.com
FAC185	Dr S Pal Kishan Reddy	9164084638	IN	palkishanreddy2022@gmail.com
FAC184	Dr Naveen Thomas	9731222763	IN	naveenthomas04@gmail.com
FAC183	Dr Sindhu Sivaram	8861482186	IN	sindhushivaram84@gmail.com
FAC182	Dr Punit Saraogi	9833300156	IN	drpunitsaraogi@gmail.com
FAC181	Dr Mikki Singh	9686112504	IN	mikkysingh@gmail.com
FAC180	Dr Chetna Ramchandani	9820482818	IN	drchetnar@gmail.com
FAC179	Dr Jyotirmay Bharti	9650434150	IN	uman_jyoti@yahoo.co.in
FAC178	Dr Shahnawaz Bashir	8082228888	IN	drmsb2000@gmail.com
FAC177	Dr Neha Shukla	9766014730	IN	ns140786@gmail.com
FAC176	Dr Soumil Khare	9739387890	IN	soumilji@gmail.com
FAC175	Dr Tejasvi Trilok Raj	7346572717	IN	ttejasvi@umich.edu
FAC174	Dr Manas Chatterjee	8697709387	IN	drmanaschatterjee@gmail.com
FAC173	Dr Yashmin Bhat	9419040771	IN	yasmeenasif76@gmail.com
FAC172	Dr Pradeep Kumari	9623050666	IN	drgahlotpradeep@gmail.com
FAC171	Dr Rajat Kandhari	9811603070	IN	rkandhari@gmail.com
FAC170	Dr Sachin Dhawan	9818880048	IN	sac_dhawan77@yahoo.co.in
FAC169	Dr Anju Methil	9415049505	IN	dranjumethil@gmail.com
FAC168	Dr Samatha	9206551111	IN	samathan.9@gmail.com
FAC167	Dr Geetanjali Shetty	9819264666	IN	geetanjalishetty@yahoo.com
FAC166	Dr Siddhi Patel	9537895494	IN	siddhipatel7453@gmail.com
FAC165	Dr Dipak Kulkarni	9820436342	IN	drdipakkulkarni@gmail.com
FAC164	Dr Subodh Sirur	9821066407	IN	subodh.sirur@yahoo.com
FAC163	Dr Janak Thakkar	9998127171	IN	drjkthakkar@gmail.com
FAC162	Dr Neeraj Pandey	9415049505	IN	neerajdermaklinic@gmail.com
FAC161	Dr Ankur Talwar	9621191111	IN	docankurtalwar@gmail.com
FAC160	Dr Himanshu Gupta	9958347966	IN	dr.himanshu87@gmail.com
FAC159	Dr Ranjan Raval	9327022606	IN	ranjanmb@yahoo.com
FAC158	Dr Rupa Shah	9824253202	IN	rtshah68@gmail.com
FAC157	Dr Neetu Rajdeo	9869171262	IN	neeturajdeo@yahoo.co.in
FAC156	Dr Kirti Shah	9825651751	IN	drkirtipshah@yahoo.in
FAC155	Dr Samipa Mukherjee	9606780956	IN	drsamipadermatology@gmail.com
FAC154	Dr Priyanka Dhanotia	9617223226	IN	dhanotia.priyanka@gmail.com
FAC153	Dr Snehal Sriram	9920343427	IN	snehalsriram@gmail.com
FAC152	Dr Sapna Parekh	9665154116	IN	sapna1622@gmail.com
FAC151	Dr Manjari Garg	9584478408	IN	manjarigarg2985@gmail.com
FAC150	Dr Pallavi Singh Oculoplastic	7600477030	IN	drpallavisingh.rpc@gmail.com
FAC149	Dr Hitalkumar Patel	9824601777	IN	skinconsultation@gmail.com
FAC148	Dr Smita Nagpal	9825721525	IN	nagpalsmita@gmail.com
FAC147	Dr Jagdish Sakhiya	8155900010	IN	j_sakhiya@yahoo.com
FAC145	Dr Shivang Patel	9033761231	IN	drshivangpatel@gmail.com
FAC144	Dr Deepti Dhingra	7095958333	IN	deeptiidhingra@gmail.com
FAC143	Dr Karthik Ram	8939784777	IN	drkarthikram@gmail.com
FAC142	Dr Amit Luthra	9810062254	IN	amit_skin01@yahoo.com
FAC141	Dr Nitin Sethi	8284999700	IN	drnitinsethi@gmail.com
FAC140	Dr Viral Desai	9820292573	IN	drviral@drviraldesai.com
FAC139	Dr Ashutosh Shah	9879546805	IN	ashutosh.apple@gmail.com
FAC138	Dr Maya Vedamurthy	9840062115	IN	mayavedamurthy@yahoo.com
FAC137	Dr Jay Modha	8849052513	IN	jaymodha78@gmail.com
FAC136	Dr Pooja Desai	7874943691	IN	poojadesai314@gmail.com
FAC135	Dr Hardik Pitroda	9313975824	IN	drhardikpitroda@gmail.com
FAC134	Dr Priya Agarwal	8511501507	IN	dreamderm2016@gmail.com
FAC133	Dr Sadhana Deshmukh	9819057671	IN	drsadhanad@yahoo.com
FAC132	Dr Meghana Gupta	9873496734	IN	dr_meghna8@yahoo.co.in
FAC131	Dr Abhay Talathi	9769585491	IN	abhay38@rediffmail.com
FAC130	Dr Aseem Sharma	9920868737	IN	aseemsharma082@gmail.com
FAC129	Dr Jaishree Sharad	8433899075	IN	jaishree19@gmail.com
FAC128	Dr Farida Modi	9821426648	IN	faridamodi@gmail.com
FAC127	Dr Nidhi Tandon	8795967000	IN	nidhisinghtandon@gmail.com
FAC126	Dr Falguni Shah	9820419899	IN	drphalgunishah@gmail.com
FAC125	Dr Madhuri Agarwal	9892680908	IN	adrmadhu@hotmail.com
FAC124	Dr Priti Shenai	9819407072	IN	drpritishenai@gmail.com
FAC123	Dr Sanjay Dubey	9301307667	IN	info@maharshivitiligo.com
FAC122	Dr Col Anuj Bhatnagar	7875674990	IN	anuj1872@yahoo.co.in
FAC121	Dr Amit Shah	9822267468	IN	amitskin@rediffmail.com
FAC120	Dr Vijay Nagdev	7020215821	IN	dr.vijaynagdev@gmail.com
FAC119	Dr C R Srinivas	+91 4222570170	IN	srini_cr_1955@rediffmail.com
FAC118	Dr Dhwani Shah (muskat)	9558893343	IN	drdhwani21@gmail.com
FAC117	Dr Gurjot Marwah	7400455554	IN	drgurjotmarwah@gmail.com
FAC116	Dr Kashish Kalra	9650141323	IN	drkashishkalramd@gmail.com
FAC115	Dr Nishita Ranka	9769398063	IN	drnishitaranka@gmail.com
FAC114	Dr Vikram Rathore	9830110726	IN	dr-vsrathore30@yahoo.co.in
FAC113	Dr Narmada Matang	9920997433	IN	narmadamatang@gmail.com
FAC112	Dr Subhra Dhar	9830138083	IN	subhra.dhar@gmail.com
FAC111	Dr Ankit Bharti	7600418578	IN	drankithbharti@gmail.com
FAC110	Dr Rajeev Joshi	9322276418	IN	rsjdrs@gmail.com
FAC109	Dr Meera Thomas	9894160892	IN	thomasmeera2@gmail.com
FAC108	Dr Chirag Desai	9699925114	IN	83chirag@gmail.com
FAC107	Dr Sasi Atili	7674823911	IN	skattili@gmail.com
FAC106	Dr Vishal Gupta	9871213543	IN	doctor.vishalgupta@gmail.com
FAC105	Dr Mark Koh	+65 18002933297	SG	mark.koh.ja@kkh.com.sg
FAC104	Dr Geeti Khullar	9592816474	IN	geetikhullar@yahoo.com
FAC103	Dr Nehal Pandya	9428475001	IN	nehal9496@gmail.com
FAC102	Dr Sudesh Chaudhari	9825914404	IN	drsudesh_choudhary@yahoo.in
FAC101	Dr Ameesha Mahajan	9855037777	IN	drameeshamahajan@gmail.com
FAC100	Dr Gaurav Patel	9228867675	IN	drgbpatel@gmail.com
FAC099	Dr Hiral Patel	8141609161	IN	drhiral21@gmail.com
FAC098	Dr Sujala Saradhya	9900280192	IN	drsujalasa@gmail.com
FAC097	Dr Nikhil Parmar	9825603054	IN	skinclinicsparsh@gmail.com
FAC096	Dr Yogesh Bhingradiya	9825058052	IN	yogeshbhingradia@gmail.com
FAC095	Dr Arth Koshia	9662229888	IN	dr.arthkoshia@gmail.com
FAC094	Dr Vishalakshi Vishwanath	9324086679	IN	visha1967@gmail.com
FAC093	Dr Shyam Makadiya	9428250804	IN	shyammakadiya04@gmail.com
FAC092	Dr Indu Balani	9315035075	IN	drinduballani@gmail.com
FAC091	Dr Pallavi Sule	9869032700	IN	palkarpallavi@gmail.com
FAC090	Dr Hema Pant	9313052242	IN	hemapant.delhi@gmail.com
FAC089	Dr Sanjay Rajpara	+44 2074673000	UK	sanjay.rajpara1@nhs.net
FAC088	Dr Tanvi Pal	9971513416	IN	tanvikant75@gmail.com
FAC087	Dr Manjot Marwah	9805887798	IN	drmanjotmarwah@hotmail.com
FAC086	Dr Parag Talaviya	9825466553	IN	drparagtalavia@yahoo.com
FAC085	Dr Dhananjay Prajapati	9429725640	IN	drdmprajapati@yahoo.com
FAC084	Dr Kailash Bhatia	9977094350	IN	drbhatiakailash@yahoo.co.in
FAC083	Dr Jayesh Sanariya	9879460038	IN	sanariyajayesh@gmail.com
FAC082	Dr Anshul Jain	7083401151	IN	dranshuljain08@gmail.com
FAC081	Dr Mansi Shah	9429111891	IN	mansishah41196@gmail.com
FAC080	Dr Venkataram Mysore	9845363520	IN	mnvenkataram@gmail.com
FAC079	Dr Ojas Kulkarni	9820437842	IN	ojasdkulkarni@gmail.com
FAC078	Dr Dattatrey Sonwane	9820012298	IN	datta534@yahoo.com
FAC077	Dr Jay Gupte	9820012298	IN	jaygupte@gmail.com
FAC076	Dr Raghunath Reddy	9845007154	IN	raghuderma@gmail.com
FAC075	Dr Kanika Sahni	8826470322	IN	kanu.sah@gmail.com
FAC074	Dr Chander Grover	9818065653	IN	chandergroverkubba76@gmail.com
FAC073	Dr Savitha Somaiah	9880512166	IN	drsavithasomaiah@gmail.com
FAC072	Dr Soni Nanda	9999365658	IN	soninanda1975@gmail.com
FAC071	Dr Sushil Tahiliani	9820492415	IN	drsushiltt@gmail.com
FAC070	Dr Vineet Relhan	9910086636	IN	vineetrelhan@gmail.com
FAC069	Dr Shikha Bansal	9811800194	IN	findshikha@gmail.com
FAC068	Dr Vishal Gaurav	9555124075	IN	mevishalgaurav@gmail.com
FAC067	Dr Nitin Barde	9822584422	IN	nitinbarde@gmail.com
FAC066	Dr Dilip Kachawa	9414130036	IN	nupurkotwadia.13@gmail.com
FAC065	Dr Munish Paul	9810225978	IN	munishnexus@gmail.com
FAC064	Dr Somesh Gupta	9868899120	IN	someshgupta@aiims.edu
FAC063	Dr Kazomi	9909907207	IN	kazomi33@gmail.com
FAC062	Dr Madhulika Mhatre	9819023420	IN	mhatremadhulika@gmail.com
FAC061	Dr Dipti Ghia	9892758778	IN	deepti.ghia@gmail.com
FAC060	Dr Koushik Lahiri	6289621199	IN	doctorlahiri@gmail.com
FAC059	Dr Marc Roscher	+27 824158545	INTL	practise@drroscher.com
FAC058	Dr Madura C	9632741998	IN	maduradr@gmail.com
FAC057	Dr Adit M Garg	8174906767	IN	adit.mohan.garg@gmail.com
FAC056	Dr Sushil Savant	9821385544	IN	sushilsavant786@gmail.com
FAC055	Dr Shashank Bansod	7709488653	IN	challenge4u2@yahoo.co.in
FAC054	Dr Mohammad Razmi	8437633800	IN	dr.razmi.t@gmail.com
FAC053	Dr Akshay Vetal	9011332224	IN	akkiii5858@gmail.com
FAC052	Dr Niti Khunger	9013440484	IN	drkhungerniti@gmail.com
FAC051	Dr Nandita Patel	9730840004	IN	drnanditapatel@gmail.com
FAC050	Dr Salim T	9447148288	IN	tsalim7@gmail.com
FAC049	Dr Vinay Keshavmurthy	8872993222	IN	doctrvk@gmail.com
FAC048	Dr Indu Kumari	8860910544	IN	aishh.drindu@gmail.com
FAC047	Dr Nagendra Singh Beniwal	9540488611	IN	drbeniwalns@gmail.com
FAC046	Dr Govind	9844479263	IN	govindmittal@gmail.com
FAC045	Dr Shilpa K	9886553646	IN	shilpakvinod@gmail.com
FAC044	Dr Tejaswini S	9850398042	IN	winialways@gmail.com
FAC043	Dr Kinnera Boina	9492234514	IN	kinneraboina@gmail.com
FAC042	Dr Dhyey Shah	7203839839	IN	dr.dhyeyshah@gmail.com
FAC041	Dr Neha Gogia Sachde	9999961541	IN	neha_gogia1@hotmail.com
FAC040	Dr Hita Mehta	9429503188	IN	hitamehta88@gmail.com
FAC039	Dr Sanjay Mittal	9887760645	IN	drsanjay2580@gmail.com
FAC038	Dr Jigna Padhiyar	8799417752	IN	dr.jignapadhiyar@gmail.com
FAC037	Dr Subhransu Pattnaik	7751090993	IN	subhransu.pattnaik03@gmail.com
FAC036	Dr Sharmila Patil	8850635503	IN	drsharmilapatil@gmail.com
FAC035	Dr Rashmi Mahajan	9227676607	IN	rsoodmahajan@gmail.com
FAC034	Dr Sujai Suneetha	9642890381	IN	drsujai@gmail.com
FAC033	Dr Monal Sadhwani	9860678751	IN	monal181192@yahoo.co.in
FAC032	Dr Karthik Raja	7550204515	IN	skindoctorkartik@gmail.com
FAC031	Dr Radha Subramanyam	8056155501	IN	radysubramaniyan@gmail.com
FAC030	Dr Bhavesh Devani	9825358986	IN	drbsdevani@gmail.com
FAC029	Dr Samkit Shah	9712940837	IN	samkitshah1234@gmail.com
FAC028	Dr Ajay Sharma	9837269005	IN	ajay_cosmos@rediffmail.com
FAC027	Dr David Padukadan	9995104400	IN	davidpudukadan@gmail.com
FAC026	Dr Shenaz Arsiwala	9833114856	IN	drshenaz@gmail.com
FAC025	Dr Ginni Chhabria	8878608000	IN	chhabriaginni@gmail.com
FAC024	Dr Priyanka Sutaria	9099944211	IN	skinexperts019@gmail.com
FAC023	Dr Atul Kathed	9425948077	IN	atulgkathed@zohomail.in
FAC021	Dr Rahul Pillai	9847166999	IN	rahul.pillai@dermacode.in
FAC020	Dr Anuj Paul	9871237300	IN	anujannantpall@gmail.com
FAC019	Dr Suken Dashore	8390283462	IN	shukenadashore@gmail.com
FAC018	Dr Saurabh Kapadia	9824261031	IN	drsaurabhkapadia@yahoo.com
FAC017	Dr Avitus John	9894052372	IN	spdermacenter@yahoo.com
FAC016	Dr Piyush Borkhatariya	9426954367	IN	drpiyush2008@gmail.com
FAC015	Dr B S Chandrasekhar	9740091155	IN	cacs0312@hotmail.com
FAC014	Dr Sanjeev Aurangabadkar	9618090000	IN	draurangabadkar@gmail.com
FAC013	Dr Anil Ganjoo	9811066584	IN	drganjoo1965@gmail.com
FAC012	Dr Atula Gupta	9650629040	IN	atula.gupta81@gmail.com
FAC011	Dr Radhika Kopikar	9769636788	IN	dr.radhikatrivedi@gmail.com
FAC010	Dr Drashti Devani	8758040424	IN	drdrashtidevani@gmail.com
FAC009	Dr Sahil Mrigpuri	8872551999	IN	sahil57mrigpuri@gmail.com
FAC008	Dr Anurag Tiwari	9826023923	IN	anurag@hotmail.com
FAC007	Dr Girish Shah	9820844525	IN	drgkshah54@yahoo.co.in
FAC006	Dr Sheetanshu Kumar	9914211066	IN	kumar.sheetanshu@gmail.com
FAC005	Dr Saurabh Singh	9968024250	IN	saurabhdoc@yahoo.co.in
FAC004	Dr Harish Prasad	9738389028	IN	harish.harris@gmail.com
FAC003	Dr Syed Mubashir	9697343464	IN	syedmubashir2006@gmail.com
FAC002	Dr Aniruddha Ghosh	8697354467	IN	dr.ani.ghosh@gmail.com
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