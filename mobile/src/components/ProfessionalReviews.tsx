import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { professionalReviews, professionalReviewPage, type ProfessionalReviews as ReviewSummary } from '../lib/api';
import { errorText } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { Button, Card, Notice, useTheme } from '../ui';

export function ProfessionalReviews({ professionalId, onViewAll, expanded = false }: { professionalId: string; onViewAll?: () => void; expanded?: boolean }) {
  const { styles, colors } = useTheme();
  const result = useResource(() => professionalReviews(professionalId), professionalId, 'professional-reviews');
  const firstPage = useResource(() => expanded ? professionalReviewPage(professionalId, 0) : Promise.resolve([]), `${professionalId}:${expanded}`, 'review-page');
  useForegroundRefresh(result.refresh);
  const [extra, setExtra] = useState<ReviewSummary['reviews']>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const reviews = expanded ? [...(firstPage.data || []), ...extra] : (result.data?.reviews || []).slice(0, 2);
  async function more() { if (busy) return; setBusy(true); setError(''); try { const rows = await professionalReviewPage(professionalId, reviews.length); setExtra(previous => [...previous, ...rows]); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  return <Card><View style={styles.between}><Text style={styles.heading}>Ratings & reviews</Text></View><Notice message={error || result.error || firstPage.error} />
    {result.data?.count ? <>
      <View style={{ flexDirection: 'row', gap: 24, alignItems: 'center' }}>
        <View style={{ gap: 5 }}><Text style={[styles.title, { fontSize: 34 }]}>{result.data.average} <Text style={{ fontSize: 18 }}>★</Text></Text><Text style={styles.muted}>{result.data.count} reviews</Text></View>
        <View style={{ flex: 1, gap: 7 }}>{[5, 4, 3, 2, 1].map(stars => <View key={stars} accessible accessibilityLabel={`${stars} stars: ${result.data?.distribution?.[String(stars)] || 0} reviews`} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Text style={[styles.muted, { width: 12, fontSize: 11 }]}>{stars}</Text><View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.selected, overflow: 'hidden' }}><View style={{ height: 6, backgroundColor: colors.text, width: `${Math.min(100, (result.data?.distribution?.[String(stars)] || 0) / result.data!.count * 100)}%` }} /></View><Text style={[styles.muted, { width: 22, textAlign: 'right', fontSize: 10 }]}>{result.data?.distribution?.[String(stars)] || 0}</Text></View>)}</View>
      </View>
      {reviews.map((review, index) => <View key={`${review.created_at}-${index}`} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 14, gap: 7 }}><View style={styles.between}><Text style={styles.label}>{review.rating} ★ · Verified customer</Text><Text style={[styles.muted, { fontSize: 11 }]}>{new Date(review.created_at).toLocaleDateString()}</Text></View>{Boolean(review.comment) && <Text numberOfLines={expanded ? undefined : 3} style={styles.text}>{review.comment}</Text>}</View>)}
      {!expanded && onViewAll && <Button title="View more" secondary onPress={onViewAll} />}
      {expanded && reviews.length < result.data.count && <Button title="Load more reviews" secondary busy={busy || firstPage.loading} onPress={() => { void more(); }} />}
    </> : <Text style={styles.muted}>{result.loading ? 'Loading reviews…' : 'No reviews yet.'}</Text>}
  </Card>;
}

export function ProfessionalReviewsScreen({ professionalId }: { professionalId: string }) {
  const { styles } = useTheme();
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Reviews</Text><ProfessionalReviews professionalId={professionalId} expanded /></ScrollView>;
}
