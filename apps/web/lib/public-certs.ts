import { createSupabaseBrowserClient, createSupabaseServerClient } from './supabase';

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

export async function fetchPublicCertificate(publicId: string) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('public_certificate_check')
    .select('*')
    .eq('public_id', publicId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PublicCertificate | null;
}

export async function fetchPublicCertificateServer(publicId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('public_certificate_check')
    .select('*')
    .eq('public_id', publicId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PublicCertificate | null;
}
