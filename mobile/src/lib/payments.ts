import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';
import { CFEnvironment, CFSession } from 'cashfree-pg-api-contract';
import { supabase } from './supabase';

export async function openPayment(bookingId: string, onVerified: () => void, onError: (message: string) => void) {
  const { data, error } = await supabase.functions.invoke('cashfree-order', { body: { booking_id: bookingId } });
  if (error) throw new Error('Unable to start payment. Please try again.');
  if (data.paid) { onVerified(); return; }
  if (data.needs_verification) {
    const { data: result, error } = await supabase.functions.invoke('cashfree-verify', { body: { booking_id: bookingId, order_id: data.order_id } });
    if (error || !result?.paid) throw new Error('Payment is still being confirmed. Refresh your booking shortly.');
    onVerified(); return;
  }
  CFPaymentGatewayService.setCallback({
    onVerify: async (orderId: string) => {
      try {
        const { data: result, error } = await supabase.functions.invoke('cashfree-verify', { body: { booking_id: bookingId, order_id: orderId } });
        if (error || !result?.paid) throw new Error('Payment is still being confirmed. Refresh your booking shortly.');
        onVerified();
      } catch (e) { onError(e instanceof Error ? e.message : 'Unable to confirm payment.'); }
      finally { CFPaymentGatewayService.removeCallback(); }
    },
    onError: () => { CFPaymentGatewayService.removeCallback(); onError('Payment did not complete. You can retry from this booking.'); },
  });
  try {
    CFPaymentGatewayService.doWebPayment(new CFSession(data.payment_session_id, data.order_id,
      data.environment === 'production' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX));
  } catch (error) { CFPaymentGatewayService.removeCallback(); throw error; }
}
