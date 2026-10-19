import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { Palette } from '../ui';

export type AppearanceSelectProps = { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; colors: Palette };
export function AppearanceSelect({ label, value, options, onChange, colors }: AppearanceSelectProps) {
  const button = useRef<View>(null); const screen = useWindowDimensions();
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  function open() { button.current?.measureInWindow((x, y, _, height) => {
    const menuHeight = options.length * 46 + 8;
    setAnchor({ left: Math.max(10, Math.min(x, screen.width - 170)), top: y + height + menuHeight < screen.height ? y + height + 6 : Math.max(10, y - menuHeight - 6) });
  }); }
  return <>
    <Pressable ref={button} accessibilityRole="combobox" accessibilityLabel={label} accessibilityValue={{ text: options.find(option => option.value === value)?.label }} accessibilityState={{ expanded: Boolean(anchor) }} onPress={open} style={{ minHeight: 44, minWidth: 160, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel }}><Text style={{ color: colors.text, fontSize: 12 }}>{options.find(option => option.value === value)?.label}</Text><Text style={{ color: colors.muted }}>⌄</Text></Pressable>
    <Modal transparent visible={Boolean(anchor)} animationType="fade" statusBarTranslucent onRequestClose={() => setAnchor(null)}>
      <Pressable accessibilityLabel="Close appearance menu" onPress={() => setAnchor(null)} style={{ flex: 1 }} />
      {anchor && <View accessibilityViewIsModal style={{ position: 'absolute', ...anchor, width: 160, backgroundColor: colors.panel, padding: 4, borderWidth: 1, borderColor: colors.line, borderRadius: 14, elevation: 8, shadowColor: '#000', shadowOpacity: .14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: option.value === value }} onPress={() => { onChange(option.value); setAnchor(null); }} style={{ minHeight: 46, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: option.value === value ? colors.selected : 'transparent' }}><Text style={{ color: option.value === value ? colors.accent : colors.text, fontSize: 13 }}>{option.label}{option.value === value ? '  ✓' : ''}</Text></Pressable>)}
      </View>}
    </Modal>
  </>;
}
