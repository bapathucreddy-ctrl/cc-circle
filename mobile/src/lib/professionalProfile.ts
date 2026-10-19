import { supabase } from './supabase';
import type { Professional } from '../domain';
export async function professionalProfile(id: string) {
  const { data, error } = await supabase.from('professionals').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as (Professional & { is_published: boolean }) | null;
}
