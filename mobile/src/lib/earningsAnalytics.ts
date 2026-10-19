import type { EarnedService } from './professionalPayouts';
export type EarningsRange = '1D' | '5D' | '1M' | '1Y';
export function earningsAnalytics(services: EarnedService[], range: EarningsRange, now = new Date()) {
  const starts: Date[] = [];
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const count = range === '1D' ? 24 : range === '5D' ? 5 : range === '1M' ? 30 : 12;
  for (let index = 0; index < count; index++) {
    const date = new Date(today);
    if (range === '1D') date.setHours(index);
    else if (range === '1Y') { date.setDate(1); date.setMonth(date.getMonth() - (count - 1 - index)); }
    else date.setDate(date.getDate() - (count - 1 - index));
    starts.push(date);
  }
  const buckets = starts.map(date => ({ at: date.getTime(), amount: 0, count: 0 }));
  for (const service of services) {
    // Earn when the paid service ends. Older bookings fall back to their service date.
    const at = new Date(service.service_ended_at || service.starts_at).getTime();
    if (!Number.isFinite(at) || at > now.getTime() || at < buckets[0]!.at) continue;
    for (let index = buckets.length - 1; index >= 0; index--) if (at >= buckets[index]!.at) {
      buckets[index]!.amount += service.talent_payout_paise; buckets[index]!.count++; break;
    }
  }
  const totalPaise = buckets.reduce((sum, point) => sum + point.amount, 0);
  const completedServices = buckets.reduce((sum, point) => sum + point.count, 0);
  return { buckets, totalPaise, completedServices, averagePaise: completedServices ? Math.round(totalPaise / completedServices) : 0, start: starts[0]!, end: now };
}
