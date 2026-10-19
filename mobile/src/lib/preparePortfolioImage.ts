import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { readPortfolioAsset } from './readPortfolioAsset';

export const PORTFOLIO_IMAGE_LIMIT = 5_000_000;
export async function preparePortfolioImage(asset: { uri: string; width: number; height: number }) {
  // Start with a high-quality render, then reduce dimensions only if necessary.
  // Re-render the original each time, rather than repeatedly recompressing JPEGs.
  for (const [edge, quality] of [[6000, .96], [4800, .94], [3840, .92], [3200, .9], [2560, .88], [2048, .85]] as const) {
    const longest = Math.max(asset.width, asset.height);
    const actions = longest > edge ? [{ resize: asset.width >= asset.height ? { width: edge } : { height: edge } }] : [];
    const rendered = await manipulateAsync(asset.uri, actions, { compress: quality, format: SaveFormat.JPEG });
    const bytes = await readPortfolioAsset(rendered.uri);
    if (bytes.byteLength > 0 && bytes.byteLength < PORTFOLIO_IMAGE_LIMIT) return bytes;
  }
  throw new Error('This photo could not be reduced below 5 MB. Choose a smaller image.');
}
