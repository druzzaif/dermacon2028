import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabaseServer';
import * as XLSX from 'xlsx';
import { sortTopicPeople, roleName } from '@/app/lib/topicPeople';

export async function GET() {
  try {
    const { data: faculty } = await supabase.from('faculty').select('*').order('canonical_name');
    const { data: topics } = await supabase.from('session_topics').select(`
      *,
      conference_sessions ( session_code, session_name, session_date, hall ),
      faculty_topics ( role, sort_order, faculty ( canonical_name, email ) )
    `);

    const wb = XLSX.utils.book_new();

    // 1. Faculty Sheet
    const facultySheetData = faculty?.map(f => ({
      'Faculty ID': f.faculty_id,
      'Name': f.canonical_name,
      'Email': f.email,
      'Phone': f.phone,
      'Country': f.country,
      'Role': f.is_coordinator ? 'Coordinator' : 'Faculty'
    })) || [];
    const facultyWS = XLSX.utils.json_to_sheet(facultySheetData);
    XLSX.utils.book_append_sheet(wb, facultyWS, "Faculty List");

    // 2. Master Schedule Sheet
    const scheduleData: any[] = [];
    topics?.forEach(t => {
      const session = t.conference_sessions as any;
      const ftList = sortTopicPeople(t.faculty_topics || []);
      
      if (ftList.length === 0) {
        scheduleData.push({
          'Session': session?.session_code, 'Session Name': session?.session_name, 'Date': session?.session_date, 'Hall': session?.hall,
          'Seq': t.sequence_no, 'Time': `${t.start_time} - ${t.end_time}`, 'Topic': t.topic_title,
          'Faculty': 'Unassigned', 'Email': '', 'Role': ''
        });
      } else {
        ftList.forEach((ft: any) => {
          scheduleData.push({
            'Session': session?.session_code, 'Session Name': session?.session_name, 'Date': session?.session_date, 'Hall': session?.hall,
            'Seq': t.sequence_no, 'Time': `${t.start_time} - ${t.end_time}`, 'Topic': t.topic_title,
            'Faculty': ft.faculty?.canonical_name, 'Email': ft.faculty?.email, 'Role': roleName(ft.role)
          });
        });
      }
    });
    const scheduleWS = XLSX.utils.json_to_sheet(scheduleData);
    XLSX.utils.book_append_sheet(wb, scheduleWS, "Master Schedule");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="DERMACON_2028_Data.xlsx"',
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
