import { useState } from 'react';
import { Text, View } from 'react-native';
import { money } from '../domain';
import { Chip, TextButton, useTheme } from '../ui';

const amounts = [100, 250, 500, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 15000, 20000];
export function FeePresets({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { styles } = useTheme(); const [more, setMore] = useState(false);
  return <View style={{ gap: 10 }}><View style={styles.between}><Text style={styles.label}>Quick fee options</Text><TextButton title={more ? 'Fewer options' : 'More amounts'} onPress={() => setMore(previous => !previous)} /></View>
    <View style={[styles.row, { flexWrap: 'wrap' }]}>{(more ? amounts : amounts.slice(0, 6)).map(amount => <Chip key={amount} title={money(amount * 100)} selected={Number(value) === amount} onPress={() => onChange(String(amount))} />)}</View>
  </View>;
}
