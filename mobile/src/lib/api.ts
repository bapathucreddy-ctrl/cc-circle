import { supabase } from './supabase';
import { isProfessionalApp } from '../appVariant';
import { bookingFees, type Booking, type Category, type Coordinate, type Message, type Professional, type Service, type TrackingLocation } from '../domain';

export async function discover(category: Category, point: Coordinate, query: string, radius: number, now: boolean, serviceKey?: string) {
  const { data, error } = await supabase.rpc('discover_live_professionals', {
    p_category: category, p_longitude: point[0], p_latitude: point[1],
    p_query: query.trim(), p_radius_km: radius, p_available_now: now,
  });
  if (error) throw new Error(error.message);
  const people = data as Professional[];
  if (!serviceKey || !people.length) return people;
  const prices = new Map<string, number>();
  for (let offset = 0; ; offset += 500) {
    const { data: packages, error: packageError } = await supabase.from('services').select('professional_id,amount_paise')
      .in('professional_id', people.map(person => person.id)).eq('active', true).eq('service_key', serviceKey).order('id').range(offset, offset + 499);
    if (packageError) throw packageError;
    if (!packages) throw new Error('Unable to load session prices.');
    for (const item of packages) prices.set(item.professional_id, Math.min(prices.get(item.professional_id) ?? Infinity, bookingFees(item.amount_paise).buyerTotal));
    if (packages.length < 500) break;
  }
  return people.filter(person => prices.has(person.id)).map(person => ({ ...person, booking_price_paise: prices.get(person.id)! }));
}
export async function services(professionalId: string) {
  const { data, error } = await supabase.from('services').select('*').eq('professional_id', professionalId).eq('active', true).order('amount_paise');
  if (error) throw new Error(error.message);
  return data as Service[];
}
export async function myBookings() {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session) throw new Error('Sign in to view your bookings.');
  const { data, error } = await supabase.from('bookings').select('*').eq(isProfessionalApp ? 'professional_id' : 'client_id', session.session.user.id).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Booking[];
}
export async function bookingActivity() {
  const { data, error } = await supabase.rpc('booking_activity');
  if (error) throw error;
  return data as Booking[];
}
export type Availability = { available_now: boolean; is_online: boolean; is_busy: boolean };
export async function professionalAvailability(id: string, durationMinutes = 15) {
  const { data, error } = await supabase.rpc('professional_availability', { p_professional_id: id, p_duration_minutes: durationMinutes });
  if (error) throw new Error(error.message);
  const value = (data as Availability[] | null)?.[0];
  if (!value) throw new Error('This professional is unavailable.');
  return value;
}
export async function requestBooking(service: Service, startsAt: string, venue: string, point: Coordinate, notes: string, requestId: string) {
  const { data, error } = await supabase.rpc('request_booking', {
    p_service_id: service.id, p_starts_at: startsAt, p_venue: venue.trim(),
    p_longitude: point[0], p_latitude: point[1], p_notes: notes.trim(), p_request_id: requestId,
    p_expected_total_paise: bookingFees(service.amount_paise).buyerTotal,
  });
  if (error) throw new Error(error.message);
  return data as Booking;
}
export async function transitionBooking(id: string, status: Booking['status']) {
  const { error } = await supabase.rpc('transition_booking', { p_booking_id: id, p_status: status });
  if (error) throw new Error(error.message);
}
export async function messages(bookingId: string) {
  const { data, error } = await supabase.from('messages').select('*').eq('booking_id', bookingId).order('created_at');
  if (error) throw new Error(error.message);
  return data as Message[];
}
export type BookingParticipants = { client_name: string | null; professional_name: string; category: Category };
export async function bookingParticipants(bookingId: string) {
  const { data, error } = await supabase.rpc('booking_participants', { p_booking_id: bookingId });
  if (error) throw new Error(error.message);
  return (data as BookingParticipants[] | null)?.[0] || null;
}
export async function myDisplayName() {
  const { data: session, error } = await supabase.auth.getSession();
  if (error || !session.session) throw new Error('Sign in to update your name.');
  const user = session.session.user;
  const { data, error: profileError } = await supabase.from('profiles').select('full_name,display_name').eq('id', user.id).single();
  if (profileError) throw profileError;
  return data.full_name?.trim() || data.display_name?.trim() || '';
}
export async function saveDisplayName(name: string) {
  const value = name.trim();
  if (value.length < 2 || value.length > 120) throw new Error('Enter your full name (2–120 characters).');
  const { data: session, error } = await supabase.auth.getSession();
  if (error || !session.session) throw new Error('Sign in to update your name.');
  const { error: updateError } = await supabase.rpc('save_customer_full_name', { p_name: value });
  if (updateError) throw updateError;
}
export type BookingReview = { booking_id: string; rating: number; comment: string; created_at: string };
export type ProfessionalReviews = { count: number; average: number | null; distribution?: Record<string, number>; reviews: Omit<BookingReview, 'booking_id'>[] };
export async function professionalReviewPage(professionalId: string, offset: number) {
  const { data, error } = await supabase.rpc('professional_review_page', { p_professional_id: professionalId, p_offset: offset, p_limit: 20 });
  if (error) throw error;
  return (data || []) as ProfessionalReviews['reviews'];
}
export async function myReviews() {
  const { data: session, error } = await supabase.auth.getSession();
  if (error || !session.session) throw new Error('Sign in to view your reviews.');
  const { data, error: queryError } = await supabase.from('booking_reviews').select('booking_id,rating,comment,created_at').eq('client_id', session.session.user.id);
  if (queryError) throw queryError;
  return data as BookingReview[];
}
export async function bookingReview(id: string) {
  const { data, error } = await supabase.from('booking_reviews').select('booking_id,rating,comment,created_at').eq('booking_id', id).maybeSingle();
  if (error) throw error;
  return data as BookingReview | null;
}
export async function submitReview(id: string, rating: number, comment: string) {
  const { data, error } = await supabase.rpc('submit_booking_review', { p_booking_id: id, p_rating: rating, p_comment: comment.trim() });
  if (error) throw error;
  return data as BookingReview;
}
export async function professionalReviews(id: string) {
  const { data, error } = await supabase.rpc('professional_reviews', { p_professional_id: id });
  if (error) throw error;
  return data as ProfessionalReviews | null;
}
export async function sendMessage(bookingId: string, senderId: string, body: string) {
  const { error } = await supabase.from('messages').insert({ booking_id: bookingId, sender_id: senderId, body: body.trim() });
  if (error) throw new Error(error.message);
}
export async function tracking(bookingId: string) {
  const { data, error } = await supabase.from('booking_locations').select('*').eq('booking_id', bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TrackingLocation | null;
}
export async function savedIds(userId: string) {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('saved_professionals').select('professional_id').eq('user_id', userId).order('professional_id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Unable to load saved professionals.');
    ids.push(...data.map(row => row.professional_id as string));
    if (data.length < 500) return ids;
  }
}
/** Saves are an account collection, independent of GPS, radius or online state. */
export async function savedProfessionals(userId: string) {
  const people: Professional[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('saved_professionals').select('professional:professionals(*)').eq('user_id', userId).order('professional_id').range(offset, offset + 499);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Unable to load saved professionals.');
    for (const row of data as unknown as { professional: Professional | null }[]) if (row.professional) people.push(row.professional);
    if (data.length < 500) return people;
  }
}
export async function toggleSaved(userId: string, professionalId: string, saved: boolean) {
  const result = saved
    ? await supabase.from('saved_professionals').delete().eq('user_id', userId).eq('professional_id', professionalId)
    : await supabase.from('saved_professionals').upsert({ user_id: userId, professional_id: professionalId }, { onConflict: 'user_id,professional_id', ignoreDuplicates: true });
  if (result.error) throw new Error(result.error.message);
}
