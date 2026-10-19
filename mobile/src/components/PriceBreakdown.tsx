import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { money } from '../domain';
import { Button, TextButton, useTheme } from '../ui';

export function BookingFeeDetails({ amountPaise, servicePaise }: { amountPaise: number; servicePaise?: number }) {
  const { styles, colors } = useTheme();
  const platformFeePaise = Math.round(amountPaise * .7);
  const paymentHandlingPaise = amountPaise - platformFeePaise;
  return <View style={{ gap: 12 }}>
    <Text style={styles.heading}>Fee breakdown</Text>
    <View style={styles.between}><Text style={styles.text}>Platform fee</Text><Text style={styles.label}>{money(platformFeePaise)}</Text></View>
    <View style={styles.between}><Text style={styles.text}>Payment handling</Text><Text style={styles.label}>{money(paymentHandlingPaise)}</Text></View>
    <Text style={[styles.muted, { fontSize: 11 }]}>Both amounts are included in the booking fee.</Text>
    <View style={[styles.between, { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }]}><Text style={styles.label}>Booking fee total</Text><Text style={styles.label}>{money(amountPaise)}</Text></View>
    {servicePaise != null && <>
      <View style={styles.between}><Text style={styles.text}>Service fee</Text><Text style={styles.label}>{money(servicePaise)}</Text></View>
      <View style={[styles.between, { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }]}><Text style={styles.heading}>Total payable</Text><Text style={styles.heading}>{money(servicePaise + amountPaise)}</Text></View>
    </>}
  </View>;
}

export function BookingFeeInfo({ amountPaise, servicePaise }: { amountPaise: number; servicePaise?: number }) {
  const { styles, colors } = useTheme(); const [open, setOpen] = useState(false); const [hovered, setHovered] = useState(false); const [suppressHover, setSuppressHover] = useState(false);
  function dismiss() { setHovered(false); setSuppressHover(true); setOpen(false); }
  const hoverVisible = hovered && Platform.OS === 'web' && !open;
  const note = <BookingFeeDetails amountPaise={amountPaise} servicePaise={servicePaise} />;
  return <View style={{ position: 'relative', zIndex: hoverVisible ? 20 : 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Booking fee information" accessibilityHint="Shows what the booking fee covers" accessibilityState={{ expanded: open || hoverVisible }} onPress={() => { setHovered(false); setOpen(true); }} onHoverIn={() => { if (!suppressHover) setHovered(true); }} onHoverOut={() => { setHovered(false); setSuppressHover(false); }} onBlur={() => setHovered(false)} style={{ minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 14, fontWeight: '700' }}>i</Text></View>
    </Pressable>
    {hoverVisible && <View pointerEvents="none" style={{ position: 'absolute', top: 36, left: -108, width: 248, padding: 16, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 16, zIndex: 20 }}>{note}</View>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}><View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close fee information" onPress={dismiss} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#0009' }} />
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 420, alignSelf: 'center', maxHeight: '85%', borderRadius: 22, backgroundColor: colors.panel, padding: 22, gap: 18 }}><ScrollView>{note}</ScrollView><Button title="Got it" secondary onPress={dismiss} /></View>
    </View></Modal>
  </View>;
}

export function PriceBreakdown({ servicePaise, bookingFeePaise, totalPaise, paid = false, collapsible = false }: {
  servicePaise: number; bookingFeePaise: number; totalPaise: number; paid?: boolean; collapsible?: boolean;
}) {
  const { styles, colors } = useTheme(); const [expanded, setExpanded] = useState(!collapsible);
  return <View style={{ width: '100%', borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.panel }}>
    <View style={{ padding: 16, gap: 12, zIndex: 2 }}>
      <View style={styles.between}><Text style={styles.heading}>Price details</Text>{collapsible && <TextButton title={expanded ? 'Show less' : 'Show fee details'} onPress={() => setExpanded(value => !value)} />}</View>
      {expanded && <>
        <View style={styles.between}><Text style={styles.muted}>Service price</Text><Text style={styles.text}>{money(servicePaise)}</Text></View>
        <View style={[styles.between, { zIndex: 3 }]}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Text style={styles.muted}>Booking fee</Text><BookingFeeInfo amountPaise={bookingFeePaise} servicePaise={servicePaise} /></View><Text style={styles.text}>{money(bookingFeePaise)}</Text></View>
      </>}
    </View>
    <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.line }} />
    <View style={[styles.between, { padding: 16, backgroundColor: colors.selected, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }]}>
      <Text style={styles.heading}>{paid ? 'Total paid' : 'Total payable'}</Text><Text style={styles.heading}>{money(totalPaise)}</Text>
    </View>
  </View>;
}
