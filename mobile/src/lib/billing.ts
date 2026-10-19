import type { Booking } from '../domain';
export const isHourly = (booking: Pick<Booking,'billing_mode'>) => booking.billing_mode==='hourly';
export function canPayBooking(booking: Booking){
 return !booking.paid_at&&(isHourly(booking)?booking.status==='completed'&&Boolean(booking.billing_finalised_at):['accepted','en_route','arrived','completed'].includes(booking.status));
}
export function hourlyBillableHours(start:string|null,end:string|null,now=Date.now()){
 if(!start)return 0;
 const elapsed=(end?Date.parse(end):now)-Date.parse(start);
 return Number.isFinite(elapsed)&&elapsed>=0?Math.max(1,Math.ceil(elapsed/3600000)):0;
}
