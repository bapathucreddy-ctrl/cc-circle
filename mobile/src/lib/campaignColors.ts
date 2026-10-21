// Background tones matched to the bundled seasonal artwork, independent of app theme.
export const seasonalHomeColor = '#013832';
export function campaignBackground(id = '', uploadedColor?: string | null) {
  if (uploadedColor && /^#[0-9a-f]{6}$/i.test(uploadedColor)) return uploadedColor;
  if (/diwali/i.test(id)) return '#6A1F37';
  if (/wedding/i.test(id)) return '#DC9D88';
  if (/garba|navratri|dandiya/i.test(id)) return seasonalHomeColor;
  return '#202020';
}
export function campaignForeground(background: string) {
  const [r, g, b] = background.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  return .299 * r! + .587 * g! + .114 * b! > 150 ? '#17201D' : '#FFF6DD';
}
export function blendCampaignColor(from: string, to: string, amount: number) {
  const channels = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16));
  const a = channels(from), b = channels(to);
  return '#' + a.map((value, i) => Math.round(value + (b[i]! - value) * amount).toString(16).padStart(2, '0')).join('');
}
