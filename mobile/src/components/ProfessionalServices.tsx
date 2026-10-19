import { FeePresets } from './FeePresets';
import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { type Category, type Service, errorText, money } from '../domain';
import { useResource } from '../hooks';
import { services } from '../lib/api';
import { servicesForCategory } from '../lib/serviceCatalog';
import { supabase } from '../lib/supabase';
import { Button, Card, Field, Notice, TextButton, useTheme } from '../ui';

export function ProfessionalServiceSummary({ items, onManage }: { items: Service[]; onManage?: () => void }) {
  const { styles, colors } = useTheme();
  return <Card><View style={styles.between}><Text style={styles.heading}>Services & fees</Text>{onManage && <TextButton title="Edit" onPress={onManage} />}</View>
    {items.map(service => <View key={service.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 12, gap: 6 }}>
      <View style={styles.between}><Text style={[styles.text, { flex: 1, fontWeight: '600' }]}>{service.name}</Text><Text style={styles.label}>{money(service.amount_paise)} / session</Text></View>
      <Text style={[styles.muted, { fontSize: 12 }]}>Your earnings per session</Text>
      {Boolean(service.description) && <Text style={styles.muted}>{service.description}</Text>}
    </View>)}
    {!items.length && <Text style={styles.muted}>Add the services you offer in professional details.</Text>}
  </Card>;
}

export function ServiceTypePicker({ category, value, onChoose }: { category: Category; value: string; onChoose: (key: string, label: string) => void }) {
  const { styles, colors } = useTheme(); const [open, setOpen] = useState(false);
  return <><Button title={value || 'Choose a service'} secondary icon="chevron" onPress={() => setOpen(true)} />
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}><View style={{ backgroundColor: colors.panel, padding: 24, gap: 16, maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}><Text style={styles.heading}>Choose a service</Text><ScrollView contentContainerStyle={{ gap: 10 }}>{servicesForCategory(category).map(item => <Button key={item.key} title={item.label} secondary onPress={() => { onChoose(item.key, item.label); setOpen(false); }} />)}</ScrollView><Button title="Close" secondary onPress={() => setOpen(false)} /></View></View></Modal>
  </>;
}

export function ProfessionalServices({ userId, category }: { userId: string; category: Category }) {
  const { styles } = useTheme();
  const result = useResource(() => services(userId), userId, 'services');
  const [editing, setEditing] = useState<string | null>(null), [key, setKey] = useState(''), [name, setName] = useState('');
  const [price, setPrice] = useState(''), [duration, setDuration] = useState('60'), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  function edit(service: Service) { setEditing(service.id); setKey(service.service_key || ''); setName(service.name); setPrice(String(service.amount_paise / 100)); setDuration(String(service.duration_minutes)); setDescription(service.description); setError(''); }
  function clear() { setEditing(null); setKey(''); setName(''); setPrice(''); setDuration('60'); setDescription(''); }
  async function save() {
    setBusy(true); setError('');
    try {
      const amount = Number(price) * 100, minutes = Number(duration);
      if (!servicesForCategory(category).some(item => item.key === key)) throw new Error('Choose a service for your craft.');
      if (!Number.isInteger(amount) || amount % 100 || amount < 10000 || amount > 100000000) throw new Error('Enter whole-rupee session earnings between 100 and 10,00,000.');
      if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440) throw new Error('Enter a session duration from 15 to 1440 minutes.');
      const values = { professional_id: userId, service_key: key, name, amount_paise: amount, duration_minutes: minutes, description: description.trim(), active: true };
      const response = editing ? await supabase.from('services').update(values).eq('id', editing).eq('professional_id', userId) : await supabase.from('services').insert(values);
      if (response.error) throw response.error;
      clear(); await result.refresh();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try { const { error } = await supabase.from('services').update({ active: false }).eq('id', id).eq('professional_id', userId); if (error) throw error; if (editing === id) clear(); await result.refresh(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 14 }}><Text style={styles.heading}>Your session services</Text><Notice message={error || result.error} />
    {result.data?.map(service => <Card key={service.id}><Text style={styles.heading}>{service.name}</Text><Text style={styles.text}>{money(service.amount_paise)} / session</Text><View style={styles.row}><Button title="Edit" secondary onPress={() => edit(service)} disabled={busy} /><Button title="Remove" secondary onPress={() => { void remove(service.id); }} disabled={busy} /></View></Card>)}
    <Card><Text style={styles.heading}>{editing ? 'Edit session' : 'Add a session'}</Text><ServiceTypePicker category={category} value={name} onChoose={(key, label) => { setKey(key); setName(label); }} />
      <Field label="Your earnings per session (₹)" value={price} onChange={setPrice} numeric />
      <FeePresets value={price} onChange={setPrice} />
      <Field label="What is included?" value={description} onChange={setDescription} multiline maxLength={1000} />
      <Button title={editing ? 'Save session' : 'Add session'} onPress={() => { void save(); }} busy={busy} />
      {editing && <Button title="Cancel edit" secondary onPress={clear} disabled={busy} />}
    </Card>
  </View>;
}
