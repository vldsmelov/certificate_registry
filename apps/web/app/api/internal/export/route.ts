import { NextRequest } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';
import { Flags } from '@/lib/config';

export async function GET(request: NextRequest) {
  const session = getSession();
  requirePermission(session, 'export:run');

  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'csv';

  if (format === 'xlsx' && !Flags.enableXlsxExport) {
    return new Response('XLSX export disabled', { status: 400 });
  }

  const { rows } = await query<{
    certificate_number: string;
    public_id: string;
    status: string;
    issued_at: string;
    valid_to: string | null;
    validity_type: string;
    grade: string | null;
    exam_date: string | null;
    exam_type: string | null;
  }>(
    `
    select
      c.certificate_number,
      c.public_id,
      c.status,
      c.issued_at,
      c.valid_to,
      c.validity_type,
      ea.grade,
      ea.exam_date,
      et.name as exam_type
    from certificate c
    join exam_attempt ea on ea.id = c.exam_attempt_id
    join exam_type et on et.id = ea.exam_type_id
    order by c.issued_at desc
    `
  );

  if (format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificates');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="certificates.xlsx"'
      }
    });
  }

  const csv = stringify(rows, { header: true });
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="certificates.csv"'
    }
  });
}
