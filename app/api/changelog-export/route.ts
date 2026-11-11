import { NextResponse } from 'next/server';
import { buildChangeLogWorkbook, workbookBuffer, istParts } from '../../lib/exportData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const buf = workbookBuffer(await buildChangeLogWorkbook());
    const { date, time } = istParts();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="DERMACON_ChangeLog_' + date + '_' + time + '.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
