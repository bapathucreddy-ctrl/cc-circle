import { Text,View } from 'react-native';
import { money,type Booking } from '../domain';
import { hourlyBillableHours,isHourly } from '../lib/billing';
import { useTheme } from '../ui';
import { PriceBreakdown } from './PriceBreakdown';

export function BookingCharges({booking,professional,now=Date.now(),detailed=false}:{booking:Booking;professional:boolean;now?:number;detailed?:boolean}){
 const {styles}=useTheme();
 if(!isHourly(booking))return !professional&&detailed
   ? <PriceBreakdown servicePaise={booking.service_amount_paise} bookingFeePaise={booking.buyer_fee_paise} totalPaise={booking.amount_paise} paid={Boolean(booking.paid_at)} />
   : <Text style={styles.heading}>{professional?'You receive: ':''}{money(professional?booking.talent_payout_paise:booking.amount_paise)}</Text>;
 const rate=(professional?booking.hourly_net_paise:booking.hourly_rate_paise)||0;
 const hours=booking.billable_hours||hourlyBillableHours(booking.service_started_at,booking.service_ended_at,now);
 return <View style={{gap:8}}>
  <Text style={styles.heading}>{professional?'Your net rate':'Hourly service rate'}: {money(rate)} / hour</Text>
  <Text style={styles.muted}>Partial hours round up. Payment after service ends.</Text>
  {booking.service_started_at&&<Text style={styles.muted}>Started: {new Date(booking.service_started_at).toLocaleString()}</Text>}
  {booking.service_ended_at&&<Text style={styles.muted}>Ended: {new Date(booking.service_ended_at).toLocaleString()}</Text>}
  {hours>0&&<Text style={styles.text}>{hours} {hours===1?'hour':'hours'} × {money(rate)} = {money(hours*rate)}{!booking.billing_finalised_at?' · running estimate':''}</Text>}
  {booking.billing_finalised_at?<>
   {!professional&&detailed ? <PriceBreakdown servicePaise={booking.service_amount_paise} bookingFeePaise={booking.buyer_fee_paise} totalPaise={booking.amount_paise} paid={Boolean(booking.paid_at)} /> : <>
    {!professional&&<Text style={styles.muted}>Booking fee: {money(booking.buyer_fee_paise)}</Text>}
    <Text style={styles.heading}>{professional?'You receive':'Final amount'}: {money(professional?booking.talent_payout_paise:booking.amount_paise)}</Text>
   </>}
   <Text style={styles.muted}>{booking.paid_at?'Payment verified':professional?'Awaiting customer payment':'Pay this final invoice to finish your booking.'}</Text>
  </>:<Text style={styles.muted}>Final hours and amount are calculated from verified start/end OTP times.{!professional?' A booking fee is added once to the final invoice.':''}</Text>}
 </View>;
}
