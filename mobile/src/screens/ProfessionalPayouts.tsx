import { ServiceLoader as ActivityIndicator } from '../components/ServiceLoader';
import { EarningsDashboard } from '../components/ProfessionalAnalytics';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { errorText, money } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { professionalPayouts } from '../lib/professionalPayouts';
import { supabase } from '../lib/supabase';
import { Button, Card, EmptyState, Field, Notice, Segmented, useTheme } from '../ui';

const statusLabels = { pending: 'Pending', processing: 'Processing', paid: 'Transferred', failed: 'Failed' };
export function ProfessionalPayouts({ userId }: { userId: string }) {
  const { styles, colors } = useTheme();
  const result = useResource(() => professionalPayouts(userId), userId, 'professional-payouts');
  useForegroundRefresh(result.refresh, 30000);
  const [history, setHistory] = useState('transfers'), [limit, setLimit] = useState(20);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [accountName, setAccountName] = useState(''), [accountNumber, setAccountNumber] = useState(''), [ifsc, setIfsc] = useState('');
  async function register() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase.functions.invoke('cashfree-beneficiary', { body: { account_name: accountName.trim(), account_number: accountNumber.trim(), ifsc: ifsc.trim().toUpperCase() } });
      if (error) throw new Error('Unable to connect bank account. Check your details and try again.');
      setAccountName(''); setAccountNumber(''); setIfsc(''); await result.refresh();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  const data = result.data;
  const date = (value: string) => new Date(value).toLocaleDateString();
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={result.loading} onRefresh={() => { void result.refresh(); }} />}>
    <Text style={styles.title}>Payouts</Text>
    <Notice message={error || result.error} />
    {result.error && <Button title="Retry" secondary onPress={() => { void result.refresh(); }} />}
    {!data && result.loading && <ActivityIndicator color={colors.accent} />}
    {data && <>
      <EarningsDashboard data={data} />
      <Card><Text style={styles.muted}>Total earned</Text><Text style={[styles.title, { fontSize: 34 }]}>{money(data.summary.earned)}</Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.muted}>Transferred</Text><Text style={styles.heading}>{money(data.summary.transferred)}</Text></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.muted}>Awaiting payout</Text><Text style={styles.heading}>{money(data.summary.outstanding)}</Text></View>
        </View>
        <Text style={[styles.muted, { fontSize: 12 }]}>Net earnings from completed, paid services.</Text>
        {data.summary.processing > 0 && <Text style={styles.muted}>{money(data.summary.processing)} processing</Text>}
        {data.summary.failed > 0 && <Notice message={`${money(data.summary.failed)} in failed payouts. Contact support@cclabs.space.`} />}
      </Card>
      <Card><Text style={styles.heading}>Bank account</Text>
        {data.registered ? <Text style={styles.muted}>Connected</Text> : <>
          <Field label="Account holder name" value={accountName} onChange={setAccountName} />
          <Field label="Account number" value={accountNumber} onChange={setAccountNumber} numeric secure />
          <Field label="IFSC" value={ifsc} onChange={setIfsc} />
          <Button title="Connect bank account" onPress={register} busy={busy} disabled={!accountName.trim() || !accountNumber.trim() || !ifsc.trim()} />
        </>}
      </Card>
      <Segmented options={[{ id: 'transfers', label: 'Payout history' }, { id: 'earnings', label: 'Earnings history' }]} value={history} onChange={value => { setHistory(value); setLimit(20); }} />
      {history === 'transfers' ? <>
        {data.transfers.slice(0, limit).map(transfer => <Card key={transfer.booking_id}>
          <View style={styles.between}><Text style={styles.heading}>{money(transfer.amount_paise)}</Text><Text style={styles.muted}>{statusLabels[transfer.status]}</Text></View>
          <Text style={styles.text}>{data.services.find(service => service.id === transfer.booking_id)?.service_name || 'Service payout'}</Text>
          <Text style={styles.muted}>Requested {date(transfer.created_at)}</Text>
          <Text selectable style={[styles.muted, { fontSize: 11 }]}>Ref: {transfer.transfer_id}</Text>
        </Card>)}
        {!data.transfers.length && <EmptyState title="No payouts yet" message="Transfers will appear here." icon="wallet" />}
      </> : <>
        {data.services.slice(0, limit).map(service => <Card key={service.id}>
          <View style={styles.between}><Text style={styles.heading}>{service.service_name}</Text><Text style={styles.heading}>{money(service.talent_payout_paise)}</Text></View>
          <Text style={styles.muted}>{date(service.starts_at)}</Text>
          <Text style={styles.muted}>{statusLabels[data.transfers.find(transfer => transfer.booking_id === service.id)?.status || 'pending']}</Text>
        </Card>)}
        {!data.services.length && <EmptyState title="No earnings yet" message="Completed, paid services will appear here." icon="wallet" />}
      </>}
      {(history === 'transfers' ? data.transfers.length : data.services.length) > limit && <Button title="Show more" secondary onPress={() => setLimit(value => value + 20)} />}
    </>}
  </ScrollView>;
}
