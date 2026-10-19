import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { errorText } from '../domain';
import { loadPortfolio, type PortfolioMedia } from '../lib/portfolio';
import { useForegroundRefresh, useResource } from '../hooks';
import { Button, Icon, Notice, TextButton, useTheme } from '../ui';
import { PortfolioPlayer } from './PortfolioPlayer';

export function PortfolioGallery({ professionalId, editable = false, onDelete, onAdd, adding = false }: { professionalId: string; editable?: boolean; onDelete?: (ids: string[]) => Promise<void>; onAdd?: () => void; adding?: boolean }) {
  const { styles, colors } = useTheme();
  const result = useResource(() => loadPortfolio(professionalId), professionalId, 'portfolio');
  useForegroundRefresh(result.refresh, 15 * 60000);
  const [selected, setSelected] = useState<PortfolioMedia | null>(null);
  const [menu, setMenu] = useState(false); const [removing, setRemoving] = useState(false);
  const [checked, setChecked] = useState<string[]>([]); const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false); const [error, setError] = useState('');
  // Signed URLs rotate on refresh. Preserve URLs for photos already on screen.
  const sources = useRef(new Map<string, { uri: string; at: number }>());
  function imageUri(item: PortfolioMedia) {
    const uri = item.preview || item.src || ''; const key = `${professionalId}:${item.id}`;
    const old = sources.current.get(key);
    if (old && Date.now() - old.at < 12 * 60000) return old.uri;
    sources.current.set(key, { uri, at: Date.now() }); return uri;
  }
  async function removeSelected() {
    if (!onDelete || deleting || adding || !checked.length) return;
    setDeleting(true); setError('');
    try { await onDelete(checked); setConfirm(false); setRemoving(false); setChecked([]); }
    catch (e) { setConfirm(false); setError(errorText(e)); }
    finally { setDeleting(false); }
  }
  const media = result.data?.media || [];
  const selectedIds = checked.filter(id => media.some(item => item.id === id));
  return <View style={{ gap: 14 }}>
    <View style={styles.between}><Text style={styles.heading}>Work samples</Text><View style={styles.row}><Text style={styles.muted}>{media.length}/10</Text>{editable && <TextButton title={removing ? 'Cancel' : 'Edit'} disabled={adding || deleting} onPress={() => { setError(''); if (removing) { setRemoving(false); setChecked([]); } else setMenu(true); }} />}</View></View>
    <Notice message={error || result.error} />
    {result.loading && !result.data && <Text style={styles.muted}>Loading work samples…</Text>}
    {!result.loading && !result.error && !media.length && <Text style={styles.muted}>{editable ? 'Add your first work sample.' : 'No work samples yet.'}</Text>}
    {removing && <View style={styles.between}><Text style={styles.muted}>Select samples to remove</Text><Text style={styles.text}>{selectedIds.length} selected</Text></View>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>{media.map((item, index) => <View key={item.id} style={{ width: '32.6%', gap: 3 }}>
      <Pressable accessibilityRole={removing ? 'checkbox' : 'button'} accessibilityState={removing ? { checked: selectedIds.includes(item.id), disabled: adding || deleting } : undefined} accessibilityLabel={`${removing ? 'Select' : 'View'} work sample ${index + 1}`} disabled={adding || deleting} onPress={() => removing ? setChecked(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id]) : setSelected(item)} style={{ aspectRatio: 1, backgroundColor: colors.input, borderRadius: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        {item.preview || item.kind === 'image' && item.src ? <Image source={{ uri: imageUri(item) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="arrow" size={28} color={colors.text} />}
        {item.kind !== 'image' && <View style={{ position: 'absolute', backgroundColor: '#000b', borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 22 }}>▶</Text></View>}
        {removing && <View style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff', backgroundColor: selectedIds.includes(item.id) ? '#111' : '#0005', alignItems: 'center', justifyContent: 'center' }}>{selectedIds.includes(item.id) && <Text style={{ color: '#fff', fontWeight: '700' }}>✓</Text>}</View>}
      </Pressable>
      {editable && item.needsReview && <Text style={[styles.muted, { fontSize: 10 }]}>Needs re-upload</Text>}
    </View>)}</View>
    {removing && <Button title={`Remove${selectedIds.length ? ` (${selectedIds.length})` : ''}`} disabled={!selectedIds.length || adding || deleting} onPress={() => { setChecked(selectedIds); setConfirm(true); }} />}
    <Modal visible={menu || confirm} transparent animationType="fade" onRequestClose={() => { if (!deleting) { setMenu(false); setConfirm(false); } }}><View style={{ flex: 1, backgroundColor: '#0009', padding: 24, justifyContent: 'center' }}><View style={[styles.card, { gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' }]}>
      <Text style={styles.heading}>{confirm ? `Remove ${selectedIds.length} sample${selectedIds.length === 1 ? '' : 's'}?` : 'Edit work samples'}</Text>
      {confirm ? <><Text style={styles.muted}>Selected photos will be removed from your portfolio.</Text><Button title="Confirm removal" busy={deleting} onPress={() => { void removeSelected(); }} /><Button title="Keep samples" secondary disabled={deleting} onPress={() => setConfirm(false)} /></> : <><Text style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>Upload only your own work. No watermarks, usernames, company names or logos.</Text><Button title="Upload sample" icon="plus" disabled={adding || !onAdd || media.length >= 10} onPress={() => { setMenu(false); onAdd?.(); }} /><Button title="Remove samples" secondary disabled={!media.length || adding} onPress={() => { setMenu(false); setRemoving(true); setChecked([]); }} /><Button title="Cancel" secondary onPress={() => setMenu(false)} /></>}
    </View></View></Modal>
    <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}><View style={{ flex: 1, backgroundColor: '#000b', justifyContent: 'center', padding: 18 }}><View style={{ maxWidth: 760, width: '100%', alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.panel, borderRadius: 24, padding: 18, gap: 16 }}>
      <Button title="Close work preview" secondary onPress={() => setSelected(null)} />
      <ScrollView>{selected?.kind === 'image' ? <Image accessibilityLabel="Professional work sample" source={{ uri: selected.src || selected.preview }} resizeMode="contain" style={{ width: '100%', height: 440 }} /> : selected && <PortfolioPlayer key={selected.id} item={selected} />}</ScrollView>
    </View></View></Modal>
  </View>;
}
