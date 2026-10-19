import type { Category, Coordinate } from '../domain';
import { bookingFees } from '../domain';
import { discover } from './api';
import { servicesForCategory } from './serviceCatalog';
import { supabase } from './supabase';

export async function serviceStartingPrices(category: Category, center: Coordinate, availableNow: boolean) {
  const people = await discover(category, center, '', 15, availableNow);
  const minimums: Record<string, number> = {};
  if (!people.length) return minimums;
  const keys = servicesForCategory(category).map(service => service.key);
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('services').select('service_key,amount_paise')
      .in('professional_id', people.map(person => person.id)).in('service_key', keys).eq('active', true).order('id').range(offset, offset + 499);
    if (error) throw error;
    if (!data) throw new Error('Unable to load service prices.');
    for (const service of data) {
      if (!keys.includes(service.service_key) || !Number.isFinite(service.amount_paise) || service.amount_paise < 10000) continue;
      const total = bookingFees(service.amount_paise).buyerTotal;
      minimums[service.service_key] = Math.min(minimums[service.service_key] ?? Infinity, total);
    }
    if (data.length < 500) return minimums;
  }
}
