import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import type { ColorMode, Palette } from '../ui';

export function ColorModeToggle({ mode, colors, onChange }: { mode: ColorMode; colors: Palette; onChange: (mode: ColorMode) => void }) {
  // Show the next mode: a moon in light mode and a sun in dark mode.
  const progress = useRef(new Animated.Value(mode === 'dark' ? 1 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const target = mode === 'dark' ? 1 : 0;
    if (reduceMotion) { progress.setValue(target); return; }
    const animation = Animated.timing(progress, { toValue: target, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [mode, reduceMotion, progress]);

  return <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`} accessibilityHint={`Currently using ${mode} mode`} onPress={() => onChange(mode === 'light' ? 'dark' : 'light')}
    style={({ pressed }) => ({ width: 44, height: 44, flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}>
    <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '90deg'] }) }] }}>
      <Animated.View style={{ position: 'absolute', inset: 0, opacity: progress, transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [.35, 1] }) }] }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => <View key={angle} style={{ position: 'absolute', inset: 0, transform: [{ rotate: `${angle}deg` }] }}><View style={{ position: 'absolute', left: 11, top: 0, width: 2, height: 4, borderRadius: 1, backgroundColor: colors.text }} /></View>)}
      </Animated.View>
      <Animated.View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, overflow: 'hidden', transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, .5] }) }] }}>
        <Animated.View style={{ position: 'absolute', width: 18, height: 18, borderRadius: 9, left: 7, top: -3, backgroundColor: colors.panel, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }] }} />
      </Animated.View>
    </Animated.View>
  </Pressable>;
}
