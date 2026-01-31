import { query } from './db';

export type InternalCertificate = {
  id: string;
  public_id: string;
  certificate_number: string;
  status: string;
  issued_at: string;
  valid_to: string | null;
  validity_type: string;
  render_snapshot_json: Record<string, unknown>;
  exam_attempt: {
    grade: string;
    exam_date: string;
    signer_user_id: string | null;
    person: {
      full_name: string;
      position: string | null;
    };
    exam_type: {
      name: string;
    };
  };
};

export async function fetchInternalCertificate(publicId: string) {
  const result = await query<InternalCertificate>(
    `
    select
      c.id,
      c.public_id,
      c.certificate_number,
      c.status,
      c.issued_at,
      c.valid_to,
      c.validity_type,
      c.render_snapshot_json,
      jsonb_build_object(
        'grade', ea.grade,
        'exam_date', ea.exam_date,
        'signer_user_id', ea.signer_user_id,
        'person', jsonb_build_object(
          'full_name', p.full_name,
          'position', p.position
        ),
        'exam_type', jsonb_build_object(
          'name', et.name
        )
      ) as exam_attempt
    from certificate c
    join exam_attempt ea on ea.id = c.exam_attempt_id
    join person p on p.id = ea.person_id
    join exam_type et on et.id = ea.exam_type_id
    where c.public_id = $1
    limit 1
    `,
    [publicId]
  );

  return (result.rows[0] ?? null) as InternalCertificate | null;
}
