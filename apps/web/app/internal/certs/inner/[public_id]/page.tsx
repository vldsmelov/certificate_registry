import Link from 'next/link';
import { fetchInternalCertificate } from '@/lib/internal-certs';

export default async function InternalCertificatePage({ params }: { params: { public_id: string } }) {
  const certificate = await fetchInternalCertificate(params.public_id);

  if (!certificate) {
    return <div className="card">Сертификат не найден.</div>;
  }

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Сертификат {certificate.certificate_number}</h2>
        <div>Статус: {certificate.status}</div>
        <div>ФИО: {certificate.exam_attempt.person.full_name}</div>
        <div>Должность: {certificate.exam_attempt.person.position ?? '—'}</div>
        <div>Экзамен: {certificate.exam_attempt.exam_type.name}</div>
        <div>Оценка: {certificate.exam_attempt.grade}</div>
        <div>Дата выдачи: {certificate.issued_at}</div>
        <div>Срок до: {certificate.valid_to ?? 'Бессрочно'}</div>
        <Link className="link" href={`/api/internal/certs/${certificate.public_id}/pdf`}>
          Скачать PDF
        </Link>
      </div>
    </div>
  );
}
