import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type TextInputProps } from 'react-native';
import { sessionStorage } from './lib/sessionStorage';
import { appName } from './appVariant';
import { ColorModeToggle } from './components/ColorModeToggle';

export type ThemeName = 'minimal' | 'gallery';
export type ColorMode = 'light' | 'dark';
const lightPalette = { bg: '#f0f0f0', panel: '#ffffff', text: '#000000', muted: '#666666', accent: '#000000', action: '#000000', line: '#dddddd', input: '#f2f2f2', selected: '#e8e8e8', success: '#000000', danger: '#111111', notice: '#eeeeee' };
const palettes = { minimal: lightPalette, gallery: lightPalette };
export type Palette = typeof palettes.minimal;
const darkPalette: Palette = { bg: '#282828', panel: '#101010', text: '#ffffff', muted: '#b3b3b3', accent: '#ffffff', action: '#000000', line: '#484848', input: '#141414', selected: '#242424', success: '#ffffff', danger: '#ffffff', notice: '#303030' };
const darkPalettes: Record<ThemeName, Palette> = { minimal: darkPalette, gallery: darkPalette };
function makeStyles(colors: Palette, theme: ThemeName) {
  const gallery = theme === 'gallery';
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    content: { padding: 24, gap: 20, paddingBottom: 36, width: '100%', maxWidth: 1080, alignSelf: 'center' },
    title: { fontSize: gallery ? 38 : 30, lineHeight: gallery ? 43 : 36, fontWeight: '700', color: colors.text, letterSpacing: -1.2 },
    heading: { fontSize: 18, fontWeight: '600', color: colors.text, letterSpacing: -.3 },
    text: { color: colors.text, fontSize: 14, lineHeight: 23 }, muted: { color: colors.muted, fontSize: 13, lineHeight: 21 },
    eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.8, textTransform: 'uppercase' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    card: { backgroundColor: colors.panel, borderRadius: gallery ? 24 : 20, padding: 20, gap: 12, borderWidth: 1, borderColor: colors.line,
      ...(gallery ? { shadowColor: '#000000', shadowOpacity: .04, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } } : {}) },
    button: { backgroundColor: colors.action, borderWidth: 1, borderColor: colors.muted, borderRadius: gallery ? 28 : 24, minHeight: 48, paddingHorizontal: 20, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
    secondary: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }, buttonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    field: { gap: 8 }, label: { fontSize: 12, color: colors.text, fontWeight: '500' },
    input: { borderRadius: gallery ? 16 : 10, backgroundColor: colors.input, padding: 14, borderWidth: 1, borderColor: colors.line, color: colors.text, fontSize: 14, minHeight: 48 },
    notice: { color: colors.danger, backgroundColor: colors.notice, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 21 },
    chip: { borderRadius: gallery ? 20 : 9, paddingHorizontal: 12, paddingVertical: 9, minHeight: 40, justifyContent: 'center', backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
    chipActive: { backgroundColor: colors.selected, borderColor: colors.accent }, divider: { height: 1, backgroundColor: colors.line },
    dock: { backgroundColor: colors.panel, borderTopWidth: 1, borderColor: colors.line, padding: 18, gap: 12 }, hero: { paddingVertical: 12, gap: 18 },
  });
}
type Appearance = { theme: ThemeName; mode: ColorMode; colors: Palette; styles: ReturnType<typeof makeStyles>; setMode: (mode: ColorMode) => void };
const ThemeContext = createContext<Appearance>({ theme: 'minimal', mode: 'light', colors: palettes.minimal, styles: makeStyles(palettes.minimal, 'minimal'), setMode: () => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme: ThemeName = 'minimal';
  const [mode, setColorMode] = useState<ColorMode>('light');
  useEffect(() => {
    let active = true;
    void (async () => {
      const savedMode = Platform.OS === 'web' ? window.localStorage.getItem('cc-circle-mode') : await sessionStorage.getItem('cc-circle-mode');
      if (active && (savedMode === 'light' || savedMode === 'dark')) setColorMode(savedMode);
    })().catch(() => {});
    return () => { active = false; };
  }, []);
  function setMode(value: ColorMode) {
    setColorMode(value);
    try {
      if (Platform.OS === 'web') window.localStorage.setItem('cc-circle-mode', value);
      else void sessionStorage.setItem('cc-circle-mode', value).catch(() => {});
    } catch { /* The active preference still works without storage. */ }
  }
  const colors = mode === 'dark' ? darkPalettes[theme] : palettes[theme];
  useEffect(() => {
    if (Platform.OS === 'web') { document.documentElement.style.colorScheme = mode; document.body.style.backgroundColor = colors.bg; }
  }, [mode, colors.bg]);
  return <ThemeContext.Provider value={{ theme, mode, colors, styles: makeStyles(colors, theme), setMode }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
const icons = {
  home: require('../assets/icons/home.png'), search: require('../assets/icons/search.png'), pin: require('../assets/icons/pin.png'), calendar: require('../assets/icons/calendar.png'),
  user: require('../assets/icons/user.png'), arrow: require('../assets/icons/arrow.png'), back: require('../assets/icons/back.png'), chevron: require('../assets/icons/chevron.png'),
  plus: require('../assets/icons/plus.png'), shield: require('../assets/icons/shield.png'), heart: require('../assets/icons/heart.png'), filter: require('../assets/icons/filter.png'),
  chat: require('../assets/icons/chat.png'), check: require('../assets/icons/check.png'), close: require('../assets/icons/close.png'), target: require('../assets/icons/target.png'),
  power: require('../assets/icons/power.png'), logout: require('../assets/icons/logout.png'),
  link: require('../assets/icons/link.png'), wallet: require('../assets/icons/wallet.png'), bell: require('../assets/icons/bell.png'),
};
export type IconName = keyof typeof icons;
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Image accessible={false} source={icons[name]} style={{ width: size, height: size, tintColor: color || colors.text }} />;
}
export function IconButton({ name, label, onPress, selected = false, disabled = false }: { name: IconName; label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ width: 44, height: 44, borderWidth: 1, borderColor: selected ? colors.accent : colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.selected : colors.panel, opacity: pressed || disabled ? .55 : 1 })}><Icon name={name} color={selected ? colors.accent : colors.text} /></Pressable>;
}
export function ThemeToggle() {
  const { mode, setMode, colors } = useTheme();
  return <ColorModeToggle mode={mode} colors={colors} onChange={setMode} />;
}
export const brandCopy = { name: appName, tagline: 'CREATIVITY, CONNECTED.', footer: 'YOUR PEOPLE. YOUR CIRCLE.' };
export function BrandMark({ size = 32, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Image accessibilityLabel="Circle logo" source={require('../assets/brand/mark-black.png')} style={{ width: size, height: size, tintColor: color || colors.text }} resizeMode="contain" />;
}
export function Brand({ compact = false, stacked = false, onAccent = false }: { compact?: boolean; stacked?: boolean; onAccent?: boolean }) {
  const { colors } = useTheme();
  if (stacked) return <View testID="brand-lockup" style={{ alignItems: 'flex-start', gap: 0 }}>
    <View style={{ width: 80, height: 80, justifyContent: 'center', alignItems: 'center' }}><BrandMark size={62} color={onAccent ? '#ffffff' : undefined} /></View>
    <Text style={{ fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -1.2, color: onAccent ? '#fff' : colors.text, marginTop: 16 }}>{brandCopy.name}</Text>
    <Text style={{ fontSize: 10, lineHeight: 17, letterSpacing: 2, color: onAccent ? '#ffffffdd' : colors.muted, marginTop: 6 }}>{brandCopy.tagline}</Text>
    <Text style={{ fontSize: 9, lineHeight: 15, letterSpacing: 1.5, color: onAccent ? '#ffffffcc' : colors.muted, marginTop: 5 }}>{brandCopy.footer}</Text>
  </View>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><BrandMark size={36} color={onAccent ? '#ffffff' : undefined} />{!compact && <Text style={{ fontSize: 19, fontWeight: '700', letterSpacing: -.6, color: onAccent ? '#ffffff' : colors.text }}>{brandCopy.name}</Text>}</View>;
}
export function Button({ title, onPress, secondary = false, disabled = false, busy = false, icon }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName }) {
  const { styles, colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy) && { opacity: .5 }, pressed && { opacity: .75 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.accent : '#fff'} /> : <><Text style={[styles.buttonText, secondary && { color: colors.text }]}>{title}</Text>{icon && <Icon name={icon} size={17} color={secondary ? colors.text : '#fff'} />}</>}
  </Pressable>;
}
export function TextButton({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', opacity: disabled ? .5 : 1 }}><Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{title}</Text></Pressable>;
}
export function Field({ label, value, onChange, placeholder, numeric, multiline, secure, ...props }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; numeric?: boolean; multiline?: boolean; secure?: boolean } & Omit<TextInputProps, 'onChange' | 'value'>) {
  const { styles, colors } = useTheme(); const [focused, setFocused] = useState(false);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline} secureTextEntry={secure} {...props} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }, focused && { borderColor: colors.accent }, props.style]} /></View>;
}
export function Card({ children }: { children: ReactNode }) { const { styles } = useTheme(); return <View style={styles.card}>{children}</View>; }
export function Notice({ message }: { message: string }) { const { styles } = useTheme(); return message ? <Text accessibilityRole="alert" style={styles.notice}>{message}</Text> : null; }
export function Chip({ title, selected = false, onPress }: { title: string; selected?: boolean; onPress: () => void }) {
  const { colors, styles } = useTheme(); return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}><Text style={{ fontSize: 12, color: selected ? colors.accent : colors.text }}>{title}</Text></Pressable>;
}
export function Segmented({ options, value, onChange, compact = false }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const { colors } = useTheme(); return <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: colors.input, padding: compact ? 2 : 4, borderRadius: 12, gap: 4 }}>{options.map(option => <Pressable key={option.id} accessibilityRole="tab" aria-selected={value === option.id} accessibilityState={{ selected: value === option.id }} onPress={() => onChange(option.id)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: compact ? 7 : 11, minHeight: 44, borderRadius: 9, backgroundColor: value === option.id ? colors.panel : 'transparent' }}><Text style={{ fontSize: compact ? 11 : 12, fontWeight: value === option.id ? '600' : '400', color: value === option.id ? colors.accent : colors.muted }}>{option.label}</Text></Pressable>)}</View>;
}
export function EmptyState({ title, message, action, onAction, icon = 'search' }: { title: string; message: string; action?: string; onAction?: () => void; icon?: IconName }) {
  const { styles, colors } = useTheme(); return <Card><View style={{ alignItems: 'center', paddingVertical: 20, gap: 14 }}><Icon name={icon} size={30} color={colors.accent} /><Text style={styles.heading}>{title}</Text><Text style={[styles.muted, { textAlign: 'center', maxWidth: 360 }]}>{message}</Text>{action && onAction && <TextButton title={action} onPress={onAction} />}</View></Card>;
}
export const craftImages: Record<string, ImageSourcePropType> = { Makeup: require('../assets/crafts/makeup-neutral.png'), Actor: require('../assets/crafts/actor-neutral.png'), Photographer: require('../assets/crafts/photographer-neutral.png'), Editor: require('../assets/crafts/editor-neutral.png'), Dancer: require('../assets/crafts/dancer-neutral.png'), HairStylist: require('../assets/crafts/hairstylist-neutral.png'), ContentCreator: require('../assets/crafts/contentcreator-neutral.png') };
export const welcomeImages: Record<string, ImageSourcePropType> = { Makeup: require('../assets/welcome/makeup.jpg'), Actor: require('../assets/welcome/actor.jpg'), Photographer: require('../assets/welcome/photographer.jpg'), Editor: require('../assets/welcome/editor.jpg'), Dancer: require('../assets/welcome/dancer.jpg'), HairStylist: require('../assets/welcome/hairstylist.jpg'), ContentCreator: require('../assets/welcome/contentcreator.jpg') };

export function GalleryArtwork() {
  return <View pointerEvents="none" accessible={false} style={{ height: 130, width: '100%', overflow: 'hidden' }}>
    {[[-15, 44, 135, '-18deg'], [40, 55, 145, '26deg'], [95, 68, 120, '-34deg']].map(([left, top, width, rotation], i) => <View key={`line-${i}`} style={{ position: 'absolute', left: Number(left), top: Number(top), width: Number(width), height: 1, backgroundColor: '#ffffff35', transform: [{ rotate: String(rotation) }] }} />)}
    {[[4, 76, 26], [23, 30, 37], [44, 9, 47], [66, 21, 34], [71, 70, 20], [35, 90, 59], [88, 54, 38]].map(([left, top, size], i) => <View key={i} style={{ position: 'absolute', left: `${Number(left)}%`, top, width: size, height: size, backgroundColor: '#eeeeee', borderRadius: 50, borderWidth: 1, borderColor: '#ffffffb0', shadowColor: '#000000', shadowOpacity: .12, shadowRadius: 7, shadowOffset: { width: 2, height: 5 }, overflow: 'hidden' }}><View style={{ position: 'absolute', left: 3, top: 2, width: Number(size) * .6, height: Number(size) * .6, borderRadius: 40, backgroundColor: '#ffffff70' }} /></View>)}
  </View>;
}
export function GalleryBackdrop() {
  const { theme, colors } = useTheme();
  if (theme !== 'gallery') return null;
  return <View pointerEvents="none" accessible={false} style={{ position: 'absolute', top: 100, right: -250, width: 800, height: 800, opacity: .6 }}>{[0, 1, 2, 3, 4, 5].map(index => <View key={index} style={{ position: 'absolute', inset: index * 24, borderWidth: 1, borderColor: colors.line, borderRadius: 500 }} />)}</View>;
}
