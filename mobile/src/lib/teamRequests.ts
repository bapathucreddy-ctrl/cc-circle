import type { Booking, BookingStatus, Category, Coordinate } from '../domain';
import { supabase } from './supabase';

export type TeamRole = { category: Category; quantity: number; selected?: number };
export type TeamEvent = { id: string; title: string; requirements: string; starts_at: string; venue: string; is_owner: boolean; roles: TeamRole[];
  billing_mode?: 'fixed'|'hourly'; planned_hours?: number;
  my_application: { id: string; service_name: string; net_paise: number; booking_id: string | null; booking_status: BookingStatus | null } | null };
export type TeamApplicant = { id: string; professional_id: string; professional_name: string; category: Category; bio: string; city: string;
  service_name: string; duration_minutes: number; total_paise: number; message: string; booking_id: string | null; booking_status: BookingStatus | null };
export async function teamEvents() {
  const { data, error } = await supabase.rpc('team_requests');
  if (error) throw error;
  return data as TeamEvent[];
}
export async function postTeamEvent(title: string, requirements: string, startsAt: Date, venue: string, point: Coordinate, roles: TeamRole[], requestId: string, billingMode:'fixed'|'hourly'='fixed',plannedHours=8) {
  const { data, error } = await supabase.rpc('create_team_request', { p_title: title.trim(), p_requirements: requirements.trim(), p_starts_at: startsAt.toISOString(), p_venue: venue,
    p_longitude: point[0], p_latitude: point[1], p_roles: roles.map(({ category, quantity }) => ({ category, quantity })), p_request_id: requestId,p_billing_mode:billingMode,p_planned_hours:plannedHours });
  if (error) throw error;
  return data as string;
}
export async function teamApplicants(id: string) {
  const { data, error } = await supabase.rpc('team_applicants', { p_event_id: id });
  if (error) throw error;
  return data as TeamApplicant[];
}
export async function applyToTeam(id: string, serviceId: string, message: string,hourlyNetPaise?:number) {
  const { error } = await supabase.rpc('apply_team_request', { p_event_id: id, p_service_id: serviceId, p_message: message.trim(),p_hourly_net_paise:hourlyNetPaise??null });
  if (error) throw error;
}
export async function acceptTeamApplicant(applicant: TeamApplicant) {
  const { data, error } = await supabase.rpc('accept_team_applicant', { p_application_id: applicant.id, p_expected_total_paise: applicant.total_paise });
  if (error) throw error;
  return data as Booking;
}
export async function withdrawTeamApplication(id: string) {
  const { error } = await supabase.rpc('withdraw_team_application', { p_event_id: id });
  if (error) throw error;
}
export async function deleteTeamEvent(id: string) {
  const { error } = await supabase.rpc('delete_team_request', { p_event_id: id });
  if (error) throw error;
}
export async function teamBooking(id: string) {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Booking;
}
