import { NextRequest } from 'next/server';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';
import { createSupabaseServerClient } from '@/lib/supabase';
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

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('certificate')
    .select(
      `
      certificate_number,
      public_id,
      status,
      issued_at,
      valid_to,
      validity_type,
      exam_attempt:exam_attempt_id (
        grade,
        exam_date,
        exam_type:exam_type_id (name)
      )
    `
    )
    .order('issued_at', { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = (data ?? []).map((item) => ({
    certificate_number: item.certificate_number,
    public_id: item.public_id,
    status: item.status,
    issued_at: item.issued_at,
    valid_to: item.valid_to,
    validity_type: item.validity_type,
    grade: item.exam_attempt?.grade,
    exam_date: item.exam_attempt?.exam_date,
    exam_type: item.exam_attempt?.exam_type?.name
  }));

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
