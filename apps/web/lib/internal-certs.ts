import { createSupabaseServerClient } from './supabase';

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
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('certificate')
    .select(
      `
      id,
      public_id,
      certificate_number,
      status,
      issued_at,
      valid_to,
      validity_type,
      render_snapshot_json,
      exam_attempt:exam_attempt_id (
        grade,
        exam_date,
        signer_user_id,
        person:person_id (full_name, position),
        exam_type:exam_type_id (name)
      )
    `
    )
    .eq('public_id', publicId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as InternalCertificate | null;
}
