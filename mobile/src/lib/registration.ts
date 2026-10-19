import { supabase } from './supabase';

export type Registration = { full_name: string; email: string; email_from_sign_in: boolean; phone_verified: boolean; completed_at: string | null; professional_name: string };
export async function myRegistration() {
  const { data, error } = await supabase.rpc('my_registration');
  if (error) throw error;
  return data as Registration;
}
export async function completeRegistration(fullName: string, email: string, professionalName: string | null, professional: boolean) {
  const { data, error } = await supabase.rpc('complete_registration', { p_full_name: fullName.trim(), p_email: email.trim(), p_professional_name: professionalName?.trim() || null, p_professional: professional });
  if (error) throw error;
  return data as Registration;
}
