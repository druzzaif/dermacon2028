import { NextResponse } from 'next/server';
import { generatePDFData } from '@/app/actions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const facultyId = searchParams.get('id');

  if (!facultyId) {
    return NextResponse.json({ error: 'Missing faculty ID' }, { status: 400 });
  }

  try {
    // We reuse the generatePDFData server action!
    const result = await generatePDFData(facultyId);

    if (!result.success || !result.url) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Redirect to the generated PDF file in the public folder
    return NextResponse.redirect(new URL(result.url, req.url));
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}