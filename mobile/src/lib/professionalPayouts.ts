import { supabase } from './supabase';

export type EarnedService = { id: string; service_name: string; starts_at: string; paid_at: string; service_ended_at?: string | null; talent_payout_paise: number };
export type PayoutTransfer = { booking_id: string; amount_paise: number; status: 'pending' | 'processing' | 'paid' | 'failed'; transfer_id: string; created_at: string };

export function payoutSummary(services: EarnedService[], transfers: PayoutTransfer[]) {
  const earned = services.reduce((sum, item) => sum + item.talent_payout_paise, 0);
  const transferred = transfers.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount_paise, 0);
  return { earned, transferred, outstanding: Math.max(0, earned - transferred),
    processing: transfers.filter(item => item.status === 'processing').reduce((sum, item) => sum + item.amount_paise, 0),
    failed: transfers.filter(item => item.status === 'failed').reduce((sum, item) => sum + item.amount_paise, 0) };
}

export async function professionalPayouts(userId: string) {
  // Page every record so lifetime totals are never truncated by the API row cap.
  async function services() {
    const rows: EarnedService[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('bookings').select('id,service_name,starts_at,paid_at,service_ended_at,talent_payout_paise')
        .eq('professional_id', userId).eq('status', 'completed').not('paid_at', 'is', null)
        .order('starts_at', { ascending: false }).order('id').range(offset, offset + 499);
      if (error) throw error;
      if (!data) throw new Error('Unable to load earnings.');
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  }
  async function transfers() {
    const rows: PayoutTransfer[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('payout_jobs').select('booking_id,amount_paise,status,transfer_id,created_at')
        .eq('professional_id', userId).order('created_at', { ascending: false }).order('booking_id').range(offset, offset + 499);
      if (error) throw error;
      if (!data) throw new Error('Unable to load payouts.');
      rows.push(...data as PayoutTransfer[]);
      if (data.length < 500) return rows;
    }
  }
  async function account() {
    const { data, error } = await supabase.from('payout_accounts').select('professional_id').eq('professional_id', userId).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  const [earnedServices, payoutTransfers, registered] = await Promise.all([services(), transfers(), account()]);
  return { services: earnedServices, transfers: payoutTransfers, registered, summary: payoutSummary(earnedServices, payoutTransfers) };
}
