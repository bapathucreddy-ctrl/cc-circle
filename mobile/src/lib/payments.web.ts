import { supabase } from './supabase';

type CheckoutResult = { error?: unknown; redirect?: boolean; paymentDetails?: unknown };
type CashfreeFactory = (options: { mode: 'sandbox' | 'production' }) => {
  checkout(options: { paymentSessionId: string; redirectTarget: '_modal' }): Promise<CheckoutResult>;
};
type CashfreeWindow = Window & { Cashfree?: CashfreeFactory };
let sdkPromise: Promise<CashfreeFactory> | undefined;
function loadSdk() {
  if (typeof window === 'undefined') throw new Error('Checkout requires a browser.');
  if ((window as CashfreeWindow).Cashfree) return Promise.resolve((window as CashfreeWindow).Cashfree!);
  sdkPromise ||= new Promise<CashfreeFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'; script.async = true;
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() {
      window.clearTimeout(timeout); script.remove(); sdkPromise = undefined;
      reject(new Error('Unable to load checkout. Check your connection and try again.'));
    }
    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timeout);
      const factory = (window as CashfreeWindow).Cashfree;
      if (factory) resolve(factory); else fail();
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function openPayment(bookingId: string, onVerified: () => void, onError: (message: string) => void) {
  const { data, error } = await supabase.functions.invoke('cashfree-order', { body: { booking_id: bookingId } });
  if (error || !data) throw new Error('Unable to start payment. Please try again.');
  if (data.paid) { onVerified(); return; }
  let checkoutError = false;
  if (!data.needs_verification) {
    if (!data.payment_session_id || !data.order_id) throw new Error('Unable to open this payment session.');
    const factory = await loadSdk();
    const checkout = await factory({ mode: data.environment === 'production' ? 'production' : 'sandbox' })
      .checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_modal' });
    checkoutError = Boolean(checkout.error);
  }
  // Verify even after modal dismissal: browser callbacks never establish payment success.
  const { data: result, error: verificationError } = await supabase.functions.invoke('cashfree-verify', {
    body: { booking_id: bookingId, order_id: data.order_id },
  });
  if (!verificationError && result?.paid) { onVerified(); return; }
  onError(checkoutError ? 'Payment did not complete. Refresh this booking before retrying.'
    : 'Payment is still being confirmed. Refresh your booking shortly.');
}
