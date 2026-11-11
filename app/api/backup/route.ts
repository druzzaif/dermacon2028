import { NextResponse } from 'next/server';
import { buildBackupWorkbook, workbookBuffer, istParts } from '../../lib/exportData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const buf = workbookBuffer(await buildBackupWorkbook());
    const { date, time } = istParts();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="DERMACON_Backup_' + date + '_' + time + '.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
