import { HttpError } from './payments.ts';

export const IMAGE_LIMIT = 5_000_000;
export function imageReviewDecision(result: Record<string, any>): 'clear' | 'text' | 'logo' {
  // Conservative no-text portfolio policy: OCR cannot reliably distinguish a
  // studio watermark from a sign in the scene. Do not claim perfect detection.
  if (String(result.fullTextAnnotation?.text || '').trim() ||
    result.textAnnotations?.some((item: any) => String(item.description || '').trim())) return 'text';
  if (result.logoAnnotations?.some((item: any) => Number(item.score) >= .7)) return 'logo';
  return 'clear';
}

export async function reviewPortfolioImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length >= IMAGE_LIMIT) throw new HttpError(400, 'Each image must be smaller than 5 MB.');
  const key = Deno.env.get('GOOGLE_CLOUD_VISION_API_KEY');
  if (!key) throw new HttpError(503, 'Photo checks are not configured yet. Please try again later.');
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  let response: Response;
  try {
    response = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ requests: [{ image: { content: btoa(binary) }, features: [{ type: 'TEXT_DETECTION' }, { type: 'LOGO_DETECTION', maxResults: 20 }] }] }),
    });
  } catch { throw new HttpError(503, 'Photo checks are temporarily unavailable. Please try again.'); }
  const data = await response.json().catch(() => null);
  // Never publish on provider failure or expose OCR output, keys or messages.
  if (!response.ok || !Array.isArray(data?.responses) || data.responses.length !== 1 ||
    !data.responses[0] || typeof data.responses[0] !== 'object' || Array.isArray(data.responses[0]) || data.responses[0].error) {
    throw new HttpError(503, 'Photo checks are temporarily unavailable. Please try again.');
  }
  const decision = imageReviewDecision(data.responses[0]);
  if (decision !== 'clear') throw new HttpError(422, 'Choose an original photo without visible text, usernames, brand names or logos.');
}
