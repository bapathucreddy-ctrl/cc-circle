import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { bookingReview, submitReview } from '../lib/api';
import { useResource } from '../hooks';
import { errorText } from '../domain';
import { Button, Card, Field, Notice, useTheme } from '../ui';

export function BookingReviewCard({ bookingId, onSubmitted }: { bookingId: string; onSubmitted?: () => void }) {
  const { styles, colors } = useTheme();
  const result = useResource(() => bookingReview(bookingId), bookingId);
  const [rating, setRating] = useState(0); const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() {
    if (busy || !rating) return;
    setBusy(true); setError('');
    try { await submitReview(bookingId, rating, comment); onSubmitted?.(); await result.refresh(); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Card><Text style={styles.heading}>{result.data ? 'Thanks for sharing your experience.' : 'How was your service?'}</Text>
    <Notice message={error || result.error} />
    {result.loading ? <Text style={styles.muted}>Loading your review…</Text> : result.data ? <><Text accessibilityLabel={`${result.data.rating} out of 5 stars`} style={{ color: colors.accent, fontSize: 24 }}>{'★'.repeat(result.data.rating)}{'☆'.repeat(5 - result.data.rating)}</Text><Text style={styles.text}>{result.data.comment}</Text></> : !result.error && <>
      <Text style={styles.muted}>Rate your completed service. Your review appears as a verified customer, without your name.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Service rating" style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`} accessibilityState={{ checked: rating === value, disabled: busy }} disabled={busy} onPress={() => setRating(value)} style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32, color: value <= rating ? colors.accent : colors.muted }}>{value <= rating ? '★' : '☆'}</Text></Pressable>)}
      </View>
      <Field label="Your review (optional)" value={comment} onChange={setComment} multiline maxLength={2000} editable={!busy} placeholder="What went well? Please leave out personal or contact details." />
      <Button title="Submit review" onPress={submit} busy={busy} disabled={!rating} />
    </>}
    {Boolean(result.error) && <Button title="Retry review" secondary onPress={result.refresh} />}
  </Card>;
}
