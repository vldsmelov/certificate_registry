import { fetchPublicCertificateServer } from '@/lib/public-certs';
import { VerifyWidget } from '@cert-registry/verify-widget';

function getStatus(status: string, validTo: string | null) {
  if (status === 'revoked') return 'revoked';
  if (status === 'annulled') return 'annulled';
  if (status === 'issued' && validTo) {
    const isExpired = new Date(validTo) < new Date();
    return isExpired ? 'expired' : 'valid';
  }
  if (status === 'issued') return 'valid';
  return 'not_found';
}

export default async function PublicCertificatePage({ params }: { params: { public_id: string } }) {
  const certificate = await fetchPublicCertificateServer(params.public_id);

  if (!certificate) {
    return (
      <div className="card">
        <VerifyWidget status="not_found" />
      </div>
    );
  }

  const status = getStatus(certificate.status, certificate.valid_to);

  return (
    <div className="card">
      <VerifyWidget status={status} certificate={certificate} />
    </div>
  );
}
