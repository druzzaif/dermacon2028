import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { generatePDFData } from '@/app/actions';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const facultyId = searchParams.get('id');

  if (!facultyId) {
    return NextResponse.json({ error: 'Missing faculty ID' }, { status: 400 });
  }

  try {
    // Reuse the generatePDFData server action (it also keeps a copy in public/pdfs).
    // Optional: ?topics=id1,id2 (exact topics) and/or ?group=workshop|scientific
    const topicIds = (searchParams.get('topics') || '').split(',').map((t) => t.trim()).filter(Boolean);
    const groupParam = searchParams.get('group');
    const group = groupParam === 'workshop' || groupParam === 'scientific' ? groupParam : undefined;
    const result = await generatePDFData(facultyId, { topicIds: topicIds.length ? topicIds : undefined, group });

    if (!result.success || !result.url) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Send the file itself instead of redirecting to /pdfs/...: in production
    // (`next start`) files written to public/ after the build are not served,
    // so a redirect there returns 404.
    const fileName = path.basename(result.url);
    const pdf = fs.readFileSync(path.join(process.cwd(), 'public', 'pdfs', fileName));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
