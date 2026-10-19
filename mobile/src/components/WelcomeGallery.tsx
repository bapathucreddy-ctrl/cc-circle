import { visibleCategories } from '../lib/serviceCatalog';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Image, Platform, Text, View } from 'react-native';
import { categories, categoryLabels, type Category } from '../domain';
import { useTheme, welcomeImages } from '../ui';

function PhotoRow({ roles, width, reverse, running, wide, compact, onAccent }: { roles: readonly Category[]; width: number; reverse: boolean; running: boolean; wide: boolean; compact: boolean; onAccent: boolean }) {
  const { colors, theme } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const tileWidth = Math.max(80, (width - 28) / 3);
  const cycleWidth = roles.length * (tileWidth + 14);
  const duration = cycleWidth / (reverse ? 15 : 18) * 1000;

  useEffect(() => {
    if (!running || width === 0) return;
    let active = true;
    function advance() {
      Animated.timing(progress, { toValue: 1, duration: Math.max(1, (1 - position.current) * duration), easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false }).start(({ finished }) => {
        if (finished && active) { position.current = 0; progress.setValue(0); advance(); }
      });
    }
    advance();
    return () => { active = false; progress.stopAnimation(value => { position.current = value; }); };
  }, [running, width, duration, progress]);

  return <View style={{ overflow: 'hidden' }}>
    <Animated.View testID={reverse ? 'welcome-gallery-reverse' : 'welcome-gallery-forward'} style={{ flexDirection: 'row', gap: 14, width: cycleWidth * 2, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-cycleWidth, 0] : [0, -cycleWidth] }) }] }}>
      {[0, 1].map(copy => <View key={copy} aria-hidden={copy === 1} accessibilityElementsHidden={copy === 1} importantForAccessibility={copy === 1 ? 'no-hide-descendants' : 'auto'} style={{ flexDirection: 'row', gap: 14 }}>
        {roles.map(role => <View key={role} style={{ width: tileWidth, gap: 8 }}>
          <Image source={welcomeImages[role]} style={{ width: tileWidth, height: compact ? 64 : wide ? 140 : 96, borderRadius: theme === 'gallery' ? 22 : 13 }} resizeMode="cover" accessibilityLabel={`${categoryLabels[role]} at work`} />
          <Text style={{ fontSize: 10, textAlign: 'center', color: onAccent ? '#ffffffdd' : colors.muted }}>{categoryLabels[role]}</Text>
        </View>)}
      </View>)}
    </Animated.View>
  </View>;
}

export function WelcomeGallery({ wide, compact = false, onAccent = false }: { wide: boolean; compact?: boolean; onAccent?: boolean }) {
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const state = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { active = false; motion?.remove(); state.remove(); };
  }, []);
  const running = !reduceMotion && foreground;
  return <View style={{ gap: 14, minWidth: 0 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <PhotoRow roles={visibleCategories} width={width} reverse={false} running={running} wide={wide} compact={compact} onAccent={onAccent} />
    <PhotoRow roles={[...visibleCategories].reverse()} width={width} reverse running={running} wide={wide} compact={compact} onAccent={onAccent} />
  </View>;
}
