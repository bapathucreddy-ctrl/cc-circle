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
    // An account-specific ID makes retries idempotent without mutating a beneficiary
    // already used by an in-flight transfer. Do not retain raw account details.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${user.id}:${environment()}:${number}:${ifsc}`)));
    const suffix = Array.from(digest, value => value.toString(16).padStart(2, '0')).join('').slice(0, 12);
    const id = `ah_${user.id.replaceAll('-', '')}_${suffix}`;
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
    const { error: saveError } = await admin.rpc('save_payout_beneficiary', { p_professional_id: user.id,
      p_expected_id: existing?.beneficiary_id || null, p_beneficiary_id: id, p_environment: environment(), p_last4: number.slice(-4), p_ifsc: ifsc });
    if (saveError) throw new HttpError(409, 'Unable to save bank account. Refresh your payout details and try again.');
    // Bank details are sent to Cashfree and are not stored in the application's tables.
    return json({ registered: true });
  } catch (error) { return handleError(error); }
});
