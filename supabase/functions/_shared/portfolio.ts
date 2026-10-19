import { adminClient, HttpError } from './payments.ts';
export type Provider = 'instagram' | 'youtube';
export type ImportedMedia = { kind: 'image' | 'video' | 'youtube'; media_url?: string; preview_url?: string; youtube_id?: string; source_id?: string; storage_path?: string };
export function secret(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Account import is not configured yet. You can add photos and videos directly while the administrator completes setup.');
  return value;
}
export const callbackUrl = () => `${secret('SUPABASE_URL')}/functions/v1/portfolio-callback`;
export async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function crypt(value: string, decrypt = false) {
  const raw = Uint8Array.from(atob(secret('PORTFOLIO_TOKEN_KEY')), c => c.charCodeAt(0));
  if (raw.length !== 32) throw new HttpError(503, 'Portfolio token encryption is not configured.');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [decrypt ? 'decrypt' : 'encrypt']);
  if (decrypt) {
    const [iv, data] = value.split('.').map(part => Uint8Array.from(atob(part), c => c.charCodeAt(0)));
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv)) + '.' + btoa(String.fromCharCode(...data));
}
// Provider responses and tokens must never appear in errors/logs sent to clients.
export async function providerJson(url: string, init?: RequestInit, stage: 'provider request' | 'Instagram code exchange' | 'Instagram token exchange' | 'Instagram media read' = 'provider request') {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) {
    // Only numeric codes and our own stage labels are safe to expose. Provider
    // messages can echo credentials, account identifiers or request URLs.
    const number = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
    const code = number(data?.error?.code) ?? number(data?.code);
    const subcode = number(data?.error?.error_subcode);
    const details = [`HTTP ${response.status}`, ...(code === undefined ? [] : [`code ${code}`]), ...(subcode === undefined ? [] : [`subcode ${subcode}`])].join(', ');
    const hint = code === 190 ? 'Instagram rejected the authorization token. Reconnect your account.'
      : code === 10 || code === 200 ? 'Check that the professional Instagram account accepted its tester invitation and granted instagram_business_basic.'
      : stage === 'Instagram code exchange' ? 'Check the Instagram App ID, App Secret and exact registered redirect URL, then start a new connection.'
      : 'Check API access and reconnect your account.';
    throw new HttpError(502, `${stage} failed (${details}). ${hint}`);
  }
  if (!data) throw new HttpError(502, `${stage} returned an unreadable response. Please try again.`);
  return data;
}
export function normalizeInstagram(rows: Record<string, unknown>[]): ImportedMedia[] {
  const items: ImportedMedia[] = [];
  for (const row of rows) {
    const children = (row.children as { data?: Record<string, unknown>[] } | undefined)?.data;
    for (const item of children?.length ? children : [row]) {
      if (!['IMAGE', 'VIDEO'].includes(String(item.media_type))) continue;
      const url = String(item.media_url || '');
      if (!url.startsWith('https://')) continue;
      items.push({ kind: item.media_type === 'VIDEO' ? 'video' : 'image', media_url: url,
        preview_url: item.media_type === 'VIDEO' ? String(item.thumbnail_url || '') || undefined : url, source_id: String(item.id || '') });
      if (items.length === 10) return items;
    }
  }
  return items;
}
export function normalizeYouTube(rows: Record<string, any>[]): ImportedMedia[] {
  return rows.filter(row => row.status?.privacyStatus === 'public' && row.status?.embeddable === true && /^[A-Za-z0-9_-]{11}$/.test(row.id)).slice(0, 10).map(row => ({
    kind: 'youtube', youtube_id: row.id, source_id: row.id,
    preview_url: row.snippet?.thumbnails?.high?.url || row.snippet?.thumbnails?.medium?.url,
  }));
}
export async function fetchMedia(provider: Provider, token: string, providerUserId: string): Promise<ImportedMedia[]> {
  if (provider === 'instagram') {
    const version = Deno.env.get('INSTAGRAM_API_VERSION') || 'v25.0';
    const fields = 'id,media_type,media_url,thumbnail_url,children{id,media_type,media_url,thumbnail_url}';
    // Use the token's own account rather than the OAuth exchange user_id. That
    // ID can have a different scope, or lose precision if returned as a number.
    const data = await providerJson(`https://graph.instagram.com/${version}/me/media?fields=${encodeURIComponent(fields)}&limit=10`, { headers: { Authorization: `Bearer ${token}` } }, 'Instagram media read');
    return normalizeInstagram(data.data || []);
  }
  const headers = { Authorization: `Bearer ${token}` };
  const channel = await providerJson('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', { headers });
  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new HttpError(400, 'This Google account has no YouTube channel.');
  const playlist = await providerJson(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=30&playlistId=${encodeURIComponent(uploads)}`, { headers });
  const ids = (playlist.items || []).map((item: any) => item.contentDetails?.videoId).filter((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id)).join(',');
  if (!ids) return [];
  const videos = await providerJson(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(ids)}`, { headers });
  return normalizeYouTube(videos.items || []);
}
export async function importMedia(owner: string, provider: Provider, token: string, providerUserId: string) {
  const items = await fetchMedia(provider, token, providerUserId);
  if (!items.length) throw new HttpError(400, 'No supported public photos or playable videos were found in this account.');
  const admin = adminClient();
  const { data, error } = await admin.rpc('replace_portfolio_media', { p_professional_id: owner, p_provider: provider, p_items: items });
  if (error) throw new HttpError(500, 'Unable to save imported work.');
  return data as number;
}
