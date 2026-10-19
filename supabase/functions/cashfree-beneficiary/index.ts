import { serveRequest } from '../_shared/http.ts';
import { authenticate, body, environment, handleError, HttpError, json, rateLimit } from '../_shared/payments.ts';
import { payouts } from '../_shared/payouts.ts';

serveRequest(async req => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const input = await body(req);
    const { admin, user } = await authenticate(req);
    await rateLimit(admin, user.id);
    const name = String(input.account_name || '').trim();
    const number = String(input.account_number || '').trim();
    const ifsc = String(input.ifsc || '').trim().toUpperCase();
    if (!/^[A-Za-z ]{2,100}$/.test(name) || !/^\d{9,18}$/.test(number) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new HttpError(400, 'Check your account name, account number and IFSC.');
    const { data: professional, error } = await admin.from('professionals').select('id').eq('id', user.id).single();
    if (error || !professional) throw new HttpError(404, 'Create your professional profile first.');
    const { data: existing, error: lookupError } = await admin.from('payout_accounts').select('beneficiary_id').eq('professional_id', user.id).maybeSingle();
    if (lookupError) throw new HttpError(500, 'Unable to load payout account.');
    if (existing) throw new HttpError(409, 'A payout account is already registered. Contact support to change it.');
    const id = `cc_${user.id}`;
    let beneficiary;
    try {
      beneficiary = await payouts('/beneficiary', 'POST', { beneficiary_id: id, beneficiary_name: name,
        beneficiary_instrument_details: { bank_account_number: number, bank_ifsc: ifsc } });
    } catch {
      // A prior request may have succeeded before its response reached this function.
      beneficiary = await payouts(`/beneficiary?beneficiary_id=${encodeURIComponent(id)}`);
      if (beneficiary.beneficiary_instrument_details?.bank_account_number !== number || beneficiary.beneficiary_instrument_details?.bank_ifsc !== ifsc) throw new HttpError(409, 'Payout account details require support review.');
    }
    if (beneficiary.beneficiary_id !== id || ['INVALID','FAILED','DELETED','CANCELLED'].includes(beneficiary.beneficiary_status)) throw new HttpError(400, 'The payout provider could not verify this account.');
    const { error: saveError } = await admin.from('payout_accounts').insert({ professional_id: user.id, beneficiary_id: id, environment: environment() });
    if (saveError && saveError.code !== '23505') throw new HttpError(500, 'Unable to save payout account.');
    // Bank details are sent to Cashfree and are not stored in the application's tables.
    return json({ registered: true });
  } catch (error) { return handleError(error); }
});
