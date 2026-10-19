import { supabase } from './supabase';
export type PortfolioMedia = { id: string; provider: 'instagram' | 'youtube' | 'upload'; kind: 'image' | 'video' | 'youtube'; src?: string; preview?: string; youtubeId?: string; needsReview?: boolean };
export type Portfolio = { media: PortfolioMedia[]; connections: { provider: 'instagram' | 'youtube'; reconnect: boolean }[] };
export async function portfolioAction<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('portfolio', { body: { action, ...input } });
  if (error) {
    let message = 'Unable to update your portfolio. Please try again.';
    try { const response = await error.context?.json(); if (typeof response?.error === 'string') message = response.error; } catch { /* No provider details are exposed. */ }
    throw new Error(message);
  }
  return data as T;
}
export const loadPortfolio = (professionalId: string) => portfolioAction<Portfolio>('list', { professional_id: professionalId });
export async function importStatus(id: string) {
  const { data, error } = await supabase.rpc('portfolio_import_status', { p_import_id: id });
  if (error) throw error;
  return (data as { status: string; message: string | null }[] | null)?.[0];
}
