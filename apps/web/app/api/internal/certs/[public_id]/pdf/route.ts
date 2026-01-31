import { NextRequest } from 'next/server';
import { renderCertificatePdf } from '@cert-registry/cert-renderer';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { requirePermission } from '@/lib/rbac';

export async function GET(request: NextRequest, { params }: { params: { public_id: string } }) {
  const session = getSession();
  requirePermission(session, 'certificate:view_internal');

  const supabase = createSupabaseServerClient();
  const { data: certificate, error } = await supabase
    .from('certificate')
    .select(
      `
      public_id,
      certificate_number,
      render_snapshot_json,
      template_version_id,
      template_version:template_version_id (
        config_json,
        background_path
      )
    `
    )
    .eq('public_id', params.public_id)
    .maybeSingle();

  if (error) {
    return new Response(error.message, { status: 500 });
  }
  if (!certificate) {
    return new Response('Not found', { status: 404 });
  }

  const template = certificate.template_version as {
    config_json: unknown;
    background_path: string | null;
  } | null;

  let backgroundBytes: Uint8Array | null = null;
  if (template?.background_path) {
    const { data: backgroundData, error: bgError } = await supabase.storage
      .from('templates')
      .download(template.background_path);
    if (bgError) {
      return new Response(bgError.message, { status: 500 });
    }
    backgroundBytes = new Uint8Array(await backgroundData.arrayBuffer());
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
    templateConfig: template?.config_json ?? fallbackConfig,
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
