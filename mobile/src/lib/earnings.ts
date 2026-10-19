import { supabase } from './supabase';

export async function professionalEarnings(professionalId: string) {
  let totalPaise = 0, completedServices = 0;
  const pageSize = 500;
  // Read all pages rather than limiting lifetime earnings to PostgREST's row cap.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('bookings').select('talent_payout_paise')
      .eq('professional_id', professionalId).eq('status', 'completed').not('paid_at', 'is', null)
      .order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error('Unable to load your earnings.');
    for (const booking of data) totalPaise += booking.talent_payout_paise;
    completedServices += data.length;
    if (data.length < pageSize) return { totalPaise, completedServices };
  }
}
