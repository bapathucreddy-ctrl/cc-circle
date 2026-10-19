import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { importStatus, loadPortfolio, portfolioAction } from '../lib/portfolio';
import { preparePortfolioConnection } from '../lib/portfolioConnection';
import { preparePortfolioImage } from '../lib/preparePortfolioImage';
import { professionalPresentation } from '../lib/professionalPresentation';
import { fetchResource, resourceEntry } from '../lib/resourceCache';
import { supabase } from '../lib/supabase';
import { useResource } from '../hooks';
import { errorText } from '../domain';
import { Button, Card, Notice, useTheme } from '../ui';
import { VerifiedTickBadge } from './InstagramVerificationBadge';
import { PortfolioGallery } from './PortfolioGallery';

export function PortfolioManager({ userId, onCountChange, gridFirst = false, afterGallery }: { userId: string; onCountChange?: (count: number) => void; gridFirst?: boolean; afterGallery?: ReactNode }) {
  const { styles } = useTheme();
  const result = useResource(() => loadPortfolio(userId), userId, 'portfolio');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const popup = useRef<ReturnType<typeof preparePortfolioConnection> | null>(null);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; popup.current?.close(); }; }, []);
  useEffect(() => { if (result.data) onCountChange?.(result.data.media.filter(item => !item.needsReview).length); }, [result.data, onCountChange]);
  async function refresh(connection = false) { await result.refresh(); if (connection) await fetchResource(resourceEntry(`professional-presentation:${userId}`), () => professionalPresentation(userId)); }
  useEffect(() => {
    if (!pending) return;
    let active = true; let checking = false;
    async function poll() {
      if (checking) return; checking = true;
      try { const status = await importStatus(pending!); if (!active) return;
        if (status?.status === 'complete' || status?.status === 'failed') {
          setPending(null); setBusy(false); popup.current?.close();
          if (status.status === 'failed') setError(status.message || 'Import failed. Reconnect your account.');
          else { setMessage('Instagram verified.'); await refresh(true); }
        }
      } catch (e) { if (active) setError(errorText(e)); } finally { checking = false; }
    }
    void poll(); const timer = setInterval(() => { void poll(); }, 1500);
    const timeout = setTimeout(() => { if (active) { setPending(null); setBusy(false); setError('Connection timed out. Try connecting again.'); popup.current?.close(); } }, 10 * 60000);
    return () => { active = false; clearInterval(timer); clearTimeout(timeout); };
  }, [pending]);
  async function connect(provider: 'instagram' | 'youtube') {
    if (busy) return; popup.current = preparePortfolioConnection(); setBusy(true); setError(''); setMessage('');
    try {
      const data = await portfolioAction<{ url: string; import_id: string }>('connect', { provider });
      setPending(data.import_id);
      await popup.current.open(data.url);
    } catch (e) { popup.current?.close(); setPending(null); setBusy(false); setError(errorText(e)); }
  }
  async function remove(ids: string[]) {
    if (busy) throw new Error('Wait for the current update to finish.');
    setBusy(true); setError(''); setMessage('');
    try { for (const id of ids) await portfolioAction('delete', { id }); }
    catch (e) { setError(errorText(e)); throw e; }
    finally { await refresh(); setBusy(false); }
  }
  async function disconnect(provider: string) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await portfolioAction('disconnect', { provider }); await refresh(true); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  async function upload() {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const remaining = 10 - (result.data?.media.length || 0);
      if (remaining <= 0) throw new Error('Remove a work sample before adding another.');
      const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 1, exif: false });
      if (selected.canceled) return;
      let added = 0;
      for (const asset of selected.assets.slice(0, remaining)) {
        setMessage('Preparing photo...');
        const bytes = await preparePortfolioImage(asset);
        const mime = 'image/jpeg';
        const target = await portfolioAction<{ path: string; token: string }>('upload_url', { mime });
        const { error } = await supabase.storage.from('portfolio-work').uploadToSignedUrl(target.path, target.token, bytes, { contentType: mime });
        if (error) throw error;
        setMessage('Checking photo...');
        await portfolioAction('add_upload', { path: target.path }); added++;
      }
      setMessage(`${added} work sample${added === 1 ? '' : 's'} added.`);
    } catch (e) { setMessage(''); setError(errorText(e)); } finally { await refresh(); setBusy(false); }
  }
  const feedback = <><Notice message={error || result.error} />{Boolean(message) && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}</>;
  const controls = <Card>
    {(['instagram'] as const).map(provider => {
      const connected = result.data?.connections.some(connection => connection.provider === provider);
      const name = 'Instagram';
      return <Button key={provider} title={connected ? `Disconnect ${name}` : `Verify with ${name}`} secondary
        onPress={() => connected ? disconnect(provider) : connect(provider)} disabled={busy || result.loading || Boolean(result.error)} />;
    })}
    {result.data?.connections.some(connection => connection.provider === 'instagram' && !connection.reconnect) && <View style={styles.row}><VerifiedTickBadge /><Text style={styles.muted}>Instagram connected</Text></View>}
    <Text style={[styles.muted, { fontSize: 12 }]}>Up to 10 photos / under 5 MB each. No text or logos.</Text>
    {pending && <Text accessibilityLiveRegion="polite" style={styles.muted}>Connecting...</Text>}
  </Card>;
  const gallery = <PortfolioGallery professionalId={userId} editable onDelete={remove} onAdd={() => { void upload(); }} adding={busy} />;
  return <View style={{ gap: 16 }}>{gridFirst ? <>{gallery}{feedback}{afterGallery}{controls}</> : <>{controls}{gallery}{feedback}{afterGallery}</>}</View>;
}
