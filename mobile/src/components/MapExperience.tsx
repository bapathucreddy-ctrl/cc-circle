import { useEffect, useMemo, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View, type RefreshControlProps } from 'react-native';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';
import { TalentMap } from './TalentMap';
import type { TalentMapProps } from './TalentMap.types';
import { clampMapSheet, mapSheetStops, snapMapSheet } from '../lib/mapSheet';
import { useTheme } from '../ui';

/** One persistent map behind a draggable sheet. Only the handle captures drags. */
export function MapExperience({ map, title, subtitle, top, children, footer, refreshControl, focusKey, chromeInset = 0, startCollapsed = false }: {
  map: TalentMapProps; title: string; subtitle?: string; top?: ReactNode;
  children: ReactNode; footer?: ReactNode; refreshControl?: ReactElement<RefreshControlProps>;
  focusKey?: string; chromeInset?: number; startCollapsed?: boolean;
}) {
  const { colors } = useTheme();
  const [height, setHeight] = useState(600);
  const [sheet, setSheet] = useState(startCollapsed ? 116 : 258);
  const [settledSheet, setSettledSheet] = useState(startCollapsed ? 116 : 258);
  const [topHeight, setTopHeight] = useState(0);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { if (focusKey) scroll.current?.scrollTo({ y: 0, animated: true }); }, [focusKey]);
  const current = useRef({ height, sheet }); current.current = { height, sheet };
  useEffect(() => { if (focusKey && current.current.sheet < current.current.height * .4) { const value = mapSheetStops(current.current.height)[1]!; setSheet(value); setSettledSheet(value); } }, [focusKey]);
  const start = useRef(sheet);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { start.current = current.current.sheet; },
    onPanResponderMove: (_, gesture) => setSheet(clampMapSheet(start.current - gesture.dy, current.current.height)),
    onPanResponderRelease: (_, gesture) => { const value = snapMapSheet(start.current - gesture.dy, current.current.height, gesture.vy); setSheet(value); setSettledSheet(value); },
    onPanResponderTerminate: () => { const value = snapMapSheet(current.current.sheet, current.current.height); setSheet(value); setSettledSheet(value); },
  }), []);
  const expand = () => { const stops = mapSheetStops(height); const value = sheet < height * .4 ? stops[1]! : sheet >= height * .7 ? stops[0]! : stops[2]!; setSheet(value); setSettledSheet(value); };
  return <View testID="map-experience" style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.input }} onLayout={event => {
    const next = event.nativeEvent.layout.height;
    if (next > 0 && Math.abs(next - height) > 1) { const value = snapMapSheet(sheet / height * next, next); setHeight(next); setSheet(value); setSettledSheet(value); }
  }}>
    <View style={{ position: 'absolute', inset: 0 }}><TalentMap {...map} height={height} immersive overlayBottom={sheet} cameraOverlayBottom={settledSheet} overlayTop={chromeInset + topHeight} /></View>
    {top && <View pointerEvents="box-none" onLayout={event => setTopHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', top: chromeInset + 10, left: 12, right: 12 }}>{top}</View>}
    <View testID="map-bottom-sheet" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: sheet, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.panel, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.line, boxShadow: '0 -4px 20px #00000014', overflow: 'hidden' }}>
      <View {...pan.panHandlers} style={{ height: 28, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line }} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel={title + '. Expand or collapse panel'} accessibilityState={{ expanded: sheet >= height * .7 }} onPress={expand} style={{ paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: colors.text }} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 11, color: colors.muted }}>{subtitle}</Text>}
      </Pressable>
      <KeyboardAwareScrollView ref={scroll} keyboardShouldPersistTaps="handled" refreshControl={refreshControl} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}>{children}</KeyboardAwareScrollView>
      {footer && <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: colors.line }}>{footer}</View>}
    </View>
  </View>;
}
