import React from 'react';

export type VerificationStatus = 'valid' | 'expired' | 'revoked' | 'annulled' | 'not_found';

export type PublicCertificate = {
  certificate_number: string;
  exam_type_name: string;
  grade: string;
  issued_at: string;
  valid_to: string | null;
  validity_type: string;
  status: string;
  signer_display_name: string | null;
};

export type VerifyWidgetProps = {
  status: VerificationStatus;
  certificate?: PublicCertificate | null;
};

const statusLabels: Record<VerificationStatus, string> = {
  valid: 'Действителен',
  expired: 'Истёк срок действия',
  revoked: 'Отозван',
  annulled: 'Аннулирован',
  not_found: 'Не найден'
};

export function VerifyWidget({ status, certificate }: VerifyWidgetProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span style={{ fontWeight: 600 }}>{statusLabels[status]}</span>
      {certificate && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div>Номер: {certificate.certificate_number}</div>
          <div>Экзамен: {certificate.exam_type_name}</div>
          <div>Оценка: {certificate.grade}</div>
          <div>Подписант: {certificate.signer_display_name ?? '—'}</div>
          <div>Дата выдачи: {certificate.issued_at}</div>
          <div>
            Срок: {certificate.validity_type === 'perpetual' ? 'Бессрочно' : certificate.valid_to ?? '—'}
          </div>
        </div>
      )}
    </div>
  );
}
