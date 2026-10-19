import { ServiceLoader as ActivityIndicator } from './ServiceLoader';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { money } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { earningsAnalytics, type EarningsRange } from '../lib/earningsAnalytics';
import { professionalPayouts } from '../lib/professionalPayouts';
import { Button, Card, IconButton, Notice, TextButton, useTheme } from '../ui';
type PayoutData = Awaited<ReturnType<typeof professionalPayouts>>;
const green = '#20B26B';
function EarningsChart({ values }: { values: number[] }) {
  const [width, setWidth] = useState(280);
  const max = Math.max(1, ...values), height = 112;
  const points = values.map((value, index) => ({ x: index / Math.max(1, values.length - 1) * width, y: height - 8 - value / max * (height - 20) }));
  return <View accessible accessibilityLabel={'Earnings chart: ' + values.map(value => money(value)).join(', ')} onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }} style={{ height, marginVertical: 8, overflow: 'hidden' }}>
    {[.25, .5, .75, 1].map(position => <View key={position} style={{ position: 'absolute', top: (height - 8) * position, left: 0, right: 0, height: 1, backgroundColor: '#20B26B18' }} />)}
    {points.map((point, index) => {
      if (!index) return null; const previous = points[index - 1]!; const dx = point.x - previous.x, dy = point.y - previous.y, length = Math.sqrt(dx * dx + dy * dy);
      return <View key={index} style={{ position: 'absolute', left: (previous.x + point.x) / 2 - length / 2, top: (previous.y + point.y) / 2 - 1.25, width: length, height: 2.5, borderRadius: 2, backgroundColor: green, transform: [{ rotate: Math.atan2(dy, dx) * 180 / Math.PI + 'deg' }] }} />;
    })}
    <View style={{ position: 'absolute', left: width - 6, top: points[points.length - 1]!.y - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: green }} />
  </View>;
}
export function EarningsDashboard({ data }: { data: PayoutData }) {
  const { styles, colors } = useTheme(); const [open, setOpen] = useState(false); const [range, setRange] = useState<EarningsRange>('1D');
  function panel(expanded: boolean) {
    const selectedRange = expanded ? range : '1D';
    const info = earningsAnalytics(data.services, selectedRange);
    return <View style={{ gap: 10 }}>
      <View style={styles.between}><Text style={styles.heading}>{expanded ? 'Earnings analytics' : "Today's earnings"}</Text>{!expanded && <TextButton title="View more" onPress={() => setOpen(true)} />}</View>
      <Text style={{ color: green, fontSize: 34, fontWeight: '700', letterSpacing: -.8 }}>{money(info.totalPaise)}</Text>
      <Text style={styles.muted}>{info.completedServices} completed, paid {info.completedServices === 1 ? 'service' : 'services'}</Text>
      <EarningsChart values={info.buckets.map(point => point.amount)} />
      <View style={styles.between}><Text style={[styles.muted, { fontSize: 10 }]}>{selectedRange === '1D' ? '12 am' : info.start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text><Text style={[styles.muted, { fontSize: 10 }]}>{selectedRange === '1D' ? '11 pm' : 'Today'}</Text></View>
      {expanded && <>
        <View style={{ flexDirection: 'row', gap: 8 }}>{(['1D', '5D', '1M', '1Y'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={'Show ' + value + ' earnings'} accessibilityState={{ selected: range === value }} onPress={() => setRange(value)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: range === value ? '#20B26B22' : colors.selected }}><Text style={{ color: range === value ? green : colors.muted, fontWeight: '600', fontSize: 12 }}>{value}</Text></Pressable>)}</View>
        <View style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 16, gap: 14 }}><View style={styles.between}><Text style={styles.muted}>Average per service</Text><Text style={styles.heading}>{money(info.averagePaise)}</Text></View><View style={styles.between}><Text style={styles.muted}>Lifetime earned</Text><Text style={styles.heading}>{money(data.summary.earned)}</Text></View><View style={styles.between}><Text style={styles.muted}>Lifetime payouts</Text><Text style={styles.heading}>{money(data.summary.transferred)}</Text></View><View style={styles.between}><Text style={styles.muted}>Awaiting payout</Text><Text style={styles.heading}>{money(data.summary.outstanding)}</Text></View></View>
        {!info.completedServices && <Text style={[styles.muted, { fontSize: 12 }]}>No completed, paid services in this period.</Text>}
      </>}
    </View>;
  }
  return <><Card>{panel(false)}</Card><Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#0009' }}><View style={{ backgroundColor: colors.panel, borderRadius: 24, padding: 20, maxHeight: '88%', width: '100%', maxWidth: 620, alignSelf: 'center', gap: 12 }}><View style={{ alignItems: 'flex-end' }}><IconButton name="close" label="Close earnings analytics" onPress={() => setOpen(false)} /></View><ScrollView>{panel(true)}</ScrollView><Button title="Done" secondary onPress={() => setOpen(false)} /></View></View></Modal></>;
}
export function ProfessionalAnalytics({ userId }: { userId: string }) {
  const { colors } = useTheme(); const result = useResource(() => professionalPayouts(userId), userId, 'professional-payouts');
  useForegroundRefresh(result.refresh, 60000);
  return result.data ? <EarningsDashboard data={result.data} /> : result.error ? <Card><Notice message="Unable to load earnings analytics." /><Button title="Retry analytics" secondary onPress={result.refresh} /></Card> : <ActivityIndicator color={colors.accent} />;
}
