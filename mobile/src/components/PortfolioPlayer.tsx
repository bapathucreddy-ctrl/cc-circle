import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { PortfolioMedia } from '../lib/portfolio';
function DirectVideo({ item }: { item: PortfolioMedia }) {
  const player = useVideoPlayer(item.src || null);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ width: '100%', height: 300, borderRadius: 16 }} />;
}
export function PortfolioPlayer({ item }: { item: PortfolioMedia }) {
  if (item.kind === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(item.youtubeId || '')) return <View style={{ height: 300, borderRadius: 16, overflow: 'hidden' }}><WebView source={{ uri: `https://www.youtube-nocookie.com/embed/${item.youtubeId}?playsinline=1&rel=0` }} allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction originWhitelist={['*']} onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('https://www.youtube-nocookie.com/embed/')} onOpenWindow={() => {}} style={{ flex: 1 }} /></View>;
  return <DirectVideo item={item} />;
}
