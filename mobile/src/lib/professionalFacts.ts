import type { Professional } from '../domain';
import { questionnaires } from '../questionnaires';

const shortLabels: Record<string, string> = { experience: 'Experience', genres: 'Photography', style: 'Style', clients: 'Projects', languages: 'Languages', turnaround: 'Delivery time', revisions: 'Revisions', 'hair-services': 'Hair services', 'hair-textures': 'Hair textures', 'hair-consultation': 'Consultation', 'hair-kit': 'Tools & products', 'content-services': 'Content', 'shooting-kit': 'Equipment', deliverables: 'What’s included', 'client-preparation': 'Before your session', 'client-prep': 'Before your session', 'usage-rights': 'Usage rights' };
export function professionalFacts(person: Pick<Professional, 'category' | 'public_specs'>) {
  const facts: { id: string; label: string; value: string }[] = [];
  const seen = new Set<string>();
  for (const section of questionnaires[person.category] || []) for (const field of section.fields) {
    if (field.privateField || seen.has(field.id) || (person.category === 'Actor' && /casting|wardrobe/i.test(section.title))) continue;
    seen.add(field.id);
    const raw = person.public_specs?.[field.id]; let value = '';
    if (field.type === 'multi' && Array.isArray(raw)) value = raw.filter(item => typeof item === 'string' && field.options?.includes(item)).join(', ');
    else if (field.type === 'select' && typeof raw === 'string' && field.options?.includes(raw)) value = raw;
    else if (field.type === 'number' && (typeof raw === 'string' || typeof raw === 'number') && String(raw).trim() && Number.isFinite(Number(raw)) && Number(raw) >= (field.min ?? -Infinity) && Number(raw) <= (field.max ?? Infinity)) value = `${Number(raw)}${field.id === 'experience' ? ' years' : ''}`;
    else if ((field.type === 'text' || field.type === 'textarea') && typeof raw === 'string') value = raw.trim();
    // Never promote unknown/private fields or contact details into the summary.
    if (!value || /@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d/i.test(value)) continue;
    facts.push({ id: field.id, label: shortLabels[field.id] || field.label.replace(/\?$/, ''), value: value.length > 180 ? `${value.slice(0, 177)}…` : value });
  }
  return facts;
}
