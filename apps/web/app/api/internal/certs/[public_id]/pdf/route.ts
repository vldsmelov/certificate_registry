import { NextRequest } from 'next/server';
import { renderCertificatePdf } from '@cert-registry/cert-renderer';
import path from 'path';
import { readFile } from 'fs/promises';
import { query } from '@/lib/db';
import { getSession } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';

export async function GET(request: NextRequest, { params }: { params: { public_id: string } }) {
  const session = getSession();
  requirePermission(session, 'certificate:view_internal');

  const { rows } = await query<{
    public_id: string;
    certificate_number: string;
    render_snapshot_json: Record<string, unknown>;
    config_json: unknown | null;
    background_path: string | null;
  }>(
    `
    select
      c.public_id,
      c.certificate_number,
      c.render_snapshot_json,
      tv.config_json,
      tv.background_path
    from certificate c
    left join template_version tv on tv.id = c.template_version_id
    where c.public_id = $1
    limit 1
    `,
    [params.public_id]
  );

  const certificate = rows[0];
  if (!certificate) {
    return new Response('Not found', { status: 404 });
  }

  let backgroundBytes: Uint8Array | null = null;
  if (certificate.background_path) {
    const baseDir = process.env.TEMPLATE_STORAGE_DIR ?? process.cwd();
    const resolvedPath = path.isAbsolute(certificate.background_path)
      ? certificate.background_path
      : path.resolve(baseDir, certificate.background_path);
    try {
      backgroundBytes = new Uint8Array(await readFile(resolvedPath));
    } catch (error) {
      console.warn('Failed to read template background file', error);
    }
  }

  const baseUrl = request.nextUrl.origin;
  const publicUrl = `${baseUrl}/certs/outer/${certificate.public_id}`;

  const fallbackConfig = {
    page: { width: 842, height: 595 },
    fields: [
      { key: 'full_name', x: 80, y: 360, fontSize: 22 },
      { key: 'exam_type_name', x: 80, y: 320, fontSize: 16 },
      { key: 'certificate_number', x: 80, y: 280, fontSize: 14 },
      { key: 'issued_at', x: 80, y: 250, fontSize: 12 }
    ],
    qr: { x: 680, y: 120, size: 120 }
  };

  const pdfBytes = await renderCertificatePdf({
    snapshot: certificate.render_snapshot_json,
    templateConfig: certificate.config_json ?? fallbackConfig,
    backgroundBytes,
    publicUrl
  });

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${certificate.certificate_number}.pdf"`
    }
  });
}
