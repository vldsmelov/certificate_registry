import { query } from './db';

export type PublicCertificate = {
  public_id: string;
  certificate_number: string;
  exam_type_name: string;
  grade: string;
  issued_at: string;
  valid_to: string | null;
  validity_type: string;
  status: string;
  signer_display_name: string | null;
};

export async function fetchPublicCertificateServer(publicId: string) {
  const result = await query<PublicCertificate>(
    `select * from public_certificate_check where public_id = $1 limit 1`,
    [publicId]
  );
  return result.rows[0] ?? null;
}
