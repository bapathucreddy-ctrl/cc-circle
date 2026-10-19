import type { ComponentProps } from 'react';
import type NativePicker from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../ui';

type Props = ComponentProps<typeof NativePicker> & { mode?: 'date' | 'time' | 'datetime' | 'countdown' };
const pad = (value: number) => String(value).padStart(2, '0');
const dateString = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export default function DateTimePicker({ value, mode, minimumDate, maximumDate, onChange }: Props) {
  const { colors } = useTheme();
  const time = mode === 'time';
  return <View style={{ gap: 10, padding: 12 }}>
    <input aria-label={time ? 'Service time' : 'Service date'} type={time ? 'time' : 'date'}
      value={time ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : dateString(value)}
      min={!time && minimumDate ? dateString(minimumDate) : undefined}
      max={!time && maximumDate ? dateString(maximumDate) : undefined}
      style={{ padding: 12, fontSize: 16, border: `1px solid ${colors.line}`, borderRadius: 12, color: colors.text }}
      onChange={event => {
        if (!event.target.value) return;
        const next = new Date(value);
        const parts = event.target.value.split(time ? ':' : '-').map(Number);
        if (time) next.setHours(parts[0]!, parts[1]!, 0, 0);
        else next.setFullYear(parts[0]!, parts[1]! - 1, parts[2]!);
        if (Number.isNaN(next.getTime())) return;
        onChange?.({ type: 'set', nativeEvent: { timestamp: next.getTime(), utcOffset: -next.getTimezoneOffset() } }, next);
      }} />
    <Pressable accessibilityRole="button" onPress={() => onChange?.({ type: 'dismissed', nativeEvent: { timestamp: value.getTime(), utcOffset: -value.getTimezoneOffset() } })}>
      <Text style={{ color: colors.accent }}>Close</Text>
    </Pressable>
  </View>;
}
