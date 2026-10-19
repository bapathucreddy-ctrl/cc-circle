import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import { visibleCategories } from '../lib/serviceCatalog';
import { ServiceCraftIcon } from './ServiceCraftIcon';
export function ServiceLoader({ accessibilityLabel = 'Loading services', color: _color }: { accessibilityLabel?: string; color?: string }) {
  const values = useRef(visibleCategories.map(() => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { values.forEach(value => value.setValue(0)); return; }
    const animation = Animated.loop(Animated.stagger(110, values.map(value => Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(value, { toValue: 0, duration: 280, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    ]))));
    animation.start(); return () => animation.stop();
  }, [reduceMotion, values]);
  return <View accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: true }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 12 }}>
    {visibleCategories.map((category, index) => <Animated.View key={category} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: reduceMotion ? 1 : values[index]!.interpolate({ inputRange: [0, 1], outputRange: [.45, 1] }), transform: [{ translateY: values[index]!.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { scale: values[index]!.interpolate({ inputRange: [0, 1], outputRange: [.95, 1.1] }) }] }}><ServiceCraftIcon category={category} size={30} /></Animated.View>)}
  </View>;
}
