import { serveRequest } from '../_shared/http.ts';
import { adminClient, environment, handleError, json } from '../_shared/payments.ts';
import { payouts, requireWorker } from '../_shared/payouts.ts';

serveRequest(async req => {
  try {
    await requireWorker(req);
    const admin = adminClient();
    const { data: jobs, error } = await admin.from('payout_jobs').select('*').in('status', ['pending','processing']).lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(2);
    if (error) throw error;
    const results: { booking_id: string; status: string }[] = [];
    for (const job of jobs || []) {
      try {
        const { data: booking, error: bookingError } = await admin.from('bookings').select('*').eq('id', job.booking_id).single();
        const { data: payment, error: paymentError } = await admin.from('payment_orders').select('status,environment').eq('booking_id', job.booking_id).single();
        const { data: account, error: accountError } = await admin.from('payout_accounts').select('*').eq('professional_id', job.professional_id).single();
        if (bookingError || paymentError || accountError || booking.status !== 'completed' || !booking.paid_at || payment.status !== 'paid' ||
          payment.environment !== environment() || account.environment !== environment() || booking.talent_payout_paise !== job.amount_paise) throw new Error('Payout is not ready');
        const beneficiary = await payouts(`/beneficiary?beneficiary_id=${encodeURIComponent(account.beneficiary_id)}`);
        if (beneficiary.beneficiary_status !== 'VERIFIED' || beneficiary.beneficiary_id !== account.beneficiary_id) throw new Error('Beneficiary is not verified');
        if (job.beneficiary_id && job.beneficiary_id !== account.beneficiary_id) throw new Error('Beneficiary mismatch');
        const { error: freezeError } = await admin.from('payout_jobs').update({ beneficiary_id: account.beneficiary_id }).eq('booking_id', job.booking_id);
        if (freezeError) throw freezeError;
        let transfer;
        try { transfer = await payouts(`/transfers?transfer_id=${encodeURIComponent(job.transfer_id)}`); }
        catch (e) {
          if (!(e instanceof Error && 'status' in e && e.status === 404)) throw e;
          try { transfer = await payouts('/transfers', 'POST', { transfer_id: job.transfer_id, transfer_amount: job.amount_paise / 100,
            beneficiary_details: { beneficiary_id: account.beneficiary_id } }); }
          catch { transfer = await payouts(`/transfers?transfer_id=${encodeURIComponent(job.transfer_id)}`); }
        }
        if (transfer.transfer_id !== job.transfer_id || Math.round(Number(transfer.transfer_amount) * 100) !== job.amount_paise || transfer.beneficiary_details?.beneficiary_id !== account.beneficiary_id) throw new Error('Invalid payout response');
        const status = transfer.status === 'SUCCESS' ? 'paid' : ['FAILED','REJECTED','REVERSED'].includes(transfer.status) ? 'failed' : 'processing';
        const { error: updateError } = await admin.from('payout_jobs').update({ status, next_attempt_at: new Date(Date.now() + 60000).toISOString() }).eq('booking_id', job.booking_id).in('status', ['pending','processing']);
        if (updateError) throw updateError;
        results.push({ booking_id: job.booking_id, status });
      } catch {
        await admin.from('payout_jobs').update({ next_attempt_at: new Date(Date.now() + 300000).toISOString() }).eq('booking_id', job.booking_id).in('status', ['pending','processing']);
        results.push({ booking_id: job.booking_id, status: 'retry_pending' });
      }
    }
    return json({ results });
  } catch (error) { return handleError(error); }
});
