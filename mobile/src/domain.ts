export const categories = ['Makeup', 'Actor', 'Photographer', 'Editor', 'Dancer', 'HairStylist', 'ContentCreator'] as const;
export type Category = typeof categories[number];
export const categoryLabels: Record<Category, string> = {
  Makeup: 'Makeup artist', Actor: 'Actor', Photographer: 'Photographer', Editor: 'Editor', Dancer: 'Dancer', HairStylist: 'Hair stylist',
  ContentCreator: 'Content creator',
};
export type Coordinate = [longitude: number, latitude: number];
export const bengaluru: Coordinate = [77.6408, 12.9784];
export type Professional = {
  id: string; display_name: string; category: Category; city: string;
  bio: string; specialties: string[]; available_now: boolean;
  longitude: number; latitude: number; distance_km?: number;
  portfolio_urls: string[];
  booking_price_paise?: number | null;
  location_updated_at?: string | null;
  location_accuracy_meters?: number | null;
  public_specs?: Record<string, unknown>;
};
export type Service = {
  id: string; professional_id: string; name: string; description: string;
  amount_paise: number; duration_minutes: number;
  service_key?: string | null;
};
export type BookingStatus = 'requested' | 'accepted' | 'en_route' | 'arrived' | 'completed' | 'declined' | 'cancelled';
export type Booking = {
  id: string; client_id: string; professional_id: string; service_id: string;
  service_name: string; amount_paise: number; service_amount_paise: number; buyer_fee_paise: number;
  talent_fee_paise: number; talent_payout_paise: number; status: BookingStatus;
  starts_at: string; ends_at: string; venue: string; venue_longitude: number;
  venue_latitude: number; notes: string; paid_at: string | null; created_at: string;
  service_started_at: string | null; completion_requested_at: string | null; service_ended_at: string | null;
  billing_mode?: 'fixed' | 'hourly'; hourly_net_paise?: number | null; hourly_rate_paise?: number | null;
  billable_hours?: number | null; billing_finalised_at?: string | null;
};
export type Message = { id: string; booking_id: string; sender_id: string; body: string; created_at: string };
export type TrackingLocation = {
  booking_id: string; longitude: number; latitude: number; heading: number | null; updated_at: string;
};
export function money(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
export function bookingFees(servicePaise: number) {
  // A service's input price is the talent's desired net payout. Round each charge to rupees.
  const bookingPrice = Math.round(servicePaise / 100 / .92) * 100;
  const buyerFee = Math.min(29900, Math.max(4900, Math.round(bookingPrice / 100 * .03) * 100));
  return { buyerFee, talentFee: bookingPrice - servicePaise, bookingPrice,
    buyerTotal: bookingPrice + buyerFee, talentPayout: servicePaise };
}
export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete this action. Please try again.';
}
