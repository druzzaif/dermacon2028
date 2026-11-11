import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// Serves PDFs saved in public/pdfs. In production (`next start`) files written
// to public/ after the build are not served, so links point here instead.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  // Only plain file names ending in .pdf: no folders, no "..".
  if (!/^[\w.-]+\.pdf$/i.test(file) || file.includes('..')) {
    return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
  }
  const full = path.join(process.cwd(), 'public', 'pdfs', file);
  if (!fs.existsSync(full)) {
    return NextResponse.json({ error: 'PDF not found' }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(full)), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
      'Cache-Control': 'no-store',
    },
  });
}
