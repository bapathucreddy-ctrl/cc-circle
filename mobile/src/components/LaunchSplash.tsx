import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Platform, Text, View } from 'react-native';
import { BrandMark, brandCopy, useTheme } from '../ui';

// A short, code-driven reveal inspired by the supplied Circle film.
// Session restoration runs underneath; the animation never waits on network access.
export function LaunchSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
  const { colors, theme } = useTheme();
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const reveal = useRef(new Animated.Value(0)).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let sequence: Animated.CompositeAnimation | undefined;
    const finish = () => { if (active) onFinish(); };
    // Even an interrupted animation or unavailable accessibility API must release startup.
    const deadline = setTimeout(finish, 3800);
    const listener = reveal.addListener(({ value }) => setFrame(Math.min(35, Math.floor(value * 35))));
    void AccessibilityInfo.isReduceMotionEnabled().catch(() => false).then(reduced => {
      if (!active) return;
      if (reduced) { setReducedMotion(true); reveal.setValue(1); wordmark.setValue(1); sequence = Animated.delay(250); }
      else sequence = Animated.sequence([
        Animated.timing(reveal, { toValue: 1, duration: 1900, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(wordmark, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(600),
        Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
      ]);
      sequence.start(({ finished }) => { if (finished) finish(); });
    });
    return () => { active = false; clearTimeout(deadline); sequence?.stop(); reveal.removeListener(listener); };
  }, [ready, onFinish, reveal, wordmark, fade]);
  return <Animated.View testID="launch-splash" accessibilityLabel="Circle is opening" style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
    <View style={{ alignItems: 'center', marginTop: -36 }}>
      <View style={{ width: 152, height: 152, alignItems: 'center', justifyContent: 'center' }}>
        {reducedMotion ? <BrandMark size={110} /> : <View testID="splash-logo-trace" style={{ width: 110, height: 110, overflow: 'hidden' }}>
          <Image accessible={false} source={theme === 'gallery' ? require('../../assets/brand/splash-trace-gallery.png') : require('../../assets/brand/splash-trace-minimal.png')} resizeMode="stretch" style={{ position: 'absolute', tintColor: colors.text, width: 660, height: 660, left: -(frame % 6) * 110, top: -Math.floor(frame / 6) * 110 }} />
        </View>}
      </View>
      <Animated.View style={{ alignItems: 'center', marginTop: 24, opacity: wordmark, transform: [{ translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1.2 }}>{brandCopy.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 2.5, marginTop: 10 }}>{brandCopy.tagline}</Text>
      </Animated.View>
    </View>
    <Text style={{ position: 'absolute', bottom: 42, color: colors.muted, fontSize: 10, letterSpacing: 2 }}>{brandCopy.footer}</Text>
  </Animated.View>;
}
