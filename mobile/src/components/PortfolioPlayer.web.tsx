import type { PortfolioMedia } from '../lib/portfolio';
export function PortfolioPlayer({ item }: { item: PortfolioMedia }) {
  if (item.kind === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(item.youtubeId || '')) return <iframe title="Portfolio video" src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?playsinline=1&rel=0`} sandbox="allow-scripts allow-same-origin allow-presentation" allow="encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', height: 300, border: 0, borderRadius: 16 }} />;
  return <video aria-label="Portfolio video" src={item.src} poster={item.preview} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 480, background: '#111', borderRadius: 16 }} />;
}
