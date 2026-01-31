import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server env vars are not configured');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false
    }
  });
}

export function createSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase anon env vars are not configured');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
