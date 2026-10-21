import { AppFooter } from './AppFooter';
import { KeyboardAwareScrollView as ScrollView } from './KeyboardAwareScrollView';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bengaluru, errorText, type Coordinate } from '../domain';
import { currentLocation } from '../lib/currentLocation';
import { coordinateLocationLabel, deviceLocationLabel, type DeviceLocationSource } from '../lib/deviceLocation';
import { searchLocations, resolveLocation, type LocationResult } from '../lib/locationSearch';
import { Button, Field, Icon, IconButton, Notice, useTheme } from '../ui';
import { MapExperience } from './MapExperience';
import { createRequestId } from '../lib/requestId';

export function LocationPicker({ center, label, onSelect, compact = false, foregroundColor }: { center: Coordinate; label: string; onSelect: (point: Coordinate, label: string, source?: DeviceLocationSource) => void; compact?: boolean; foregroundColor?: string }) {
  const { styles, colors } = useTheme();
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]); const [busy, setBusy] = useState(false); const [locating, setLocating] = useState(false); const [error, setError] = useState('');
  const locationVersion = useRef(0);
  const sessionToken = useRef('');
  const [mapOpen, setMapOpen] = useState(false);
  const [pin, setPin] = useState<Coordinate>(center);
  const [pinName, setPinName] = useState('');
  const [resolving, setResolving] = useState('');
  const [viewportHeight,setViewportHeight]=useState<number|undefined>();
  useEffect(()=>{
    if(!open||Platform.OS!=='web'||typeof window==='undefined'||!window.visualViewport)return;
    const viewport=window.visualViewport;const resize=()=>setViewportHeight(viewport.height);
    resize();viewport.addEventListener('resize',resize);
    return()=>viewport.removeEventListener('resize',resize);
  },[open]);
  const selectionController = useRef<AbortController | null>(null);
  useEffect(() => () => { locationVersion.current++; selectionController.current?.abort(); }, []);
  useEffect(() => {
    setResults([]); setError(''); setBusy(false);
    if (!open || mapOpen || query.trim().length < 3) return;
    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      void searchLocations(query, center, sessionToken.current, controller.signal).then(rows => { if (!controller.signal.aborted) setResults(rows); }).catch(e => { if (!controller.signal.aborted) setError(errorText(e)); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 450);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, mapOpen, center[0], center[1]]);
  function cancelSelection() { locationVersion.current++; selectionController.current?.abort(); setResolving(''); setLocating(false); }
  function close() { Keyboard.dismiss(); sessionToken.current = ''; cancelSelection(); setOpen(false); setMapOpen(false); setQuery(''); setResults([]); setError(''); }
  function choose(point: Coordinate, value: string, source: DeviceLocationSource='manual') { onSelect(point, value, source); close(); }
  async function selectResult(result: LocationResult) {
    cancelSelection();
    const version = locationVersion.current;
    const controller = new AbortController(); selectionController.current = controller;
    setResolving(result.id); setError('');
    try {
      const point = await resolveLocation(result, sessionToken.current, controller.signal);
      if (version === locationVersion.current && !controller.signal.aborted) choose(point, result.address);
    } catch (e) { if (version === locationVersion.current && !controller.signal.aborted) setError(errorText(e)); }
    finally { if (version === locationVersion.current) setResolving(''); }
  }
  async function locate() {
    Keyboard.dismiss();
    const version = ++locationVersion.current;
    setLocating(true); setError('');
    try { const value = await currentLocation();
      const point:Coordinate=[value.coords.longitude,value.coords.latitude];
      const address=await deviceLocationLabel(point,value.coords.accuracy);
      if (version === locationVersion.current) choose(point,address,'gps');
    }
    catch (e) { if (version === locationVersion.current) setError(errorText(e)); } finally { if (version === locationVersion.current) setLocating(false); }
  }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Change location" onPress={() => { sessionToken.current = createRequestId(); setOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 7 : 10, paddingVertical: compact ? 4 : 8, minHeight: compact ? 44 : 48 }}><Icon name="pin" size={compact ? 17 : 20} color={foregroundColor || colors.accent} /><View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={[styles.text, compact && { fontSize: 12, lineHeight: 18 }, foregroundColor ? { color: foregroundColor } : undefined]}>{label}</Text>{!compact && <Text style={{ color: foregroundColor || colors.accent, fontSize: 12 }}>Change location</Text>}</View><Icon name="chevron" size={compact ? 15 : 20} color={foregroundColor || colors.muted} /></Pressable>
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS==='android'?'height':undefined} style={{ flex: 1, backgroundColor: colors.panel, maxHeight:viewportHeight }}><SafeAreaView style={{flex:1,width:'100%',maxWidth:mapOpen?undefined:680,alignSelf:'center'}}>
      <View style={[styles.between,{paddingHorizontal:22,paddingVertical:12,flexShrink:0}]}><Text style={styles.heading}>Choose your location</Text><IconButton name="close" label="Close location search" onPress={close} /></View>
      {!mapOpen&&<View style={{paddingHorizontal:22,paddingBottom:12,flexShrink:0}}><Field label="Search location" value={query} onChange={value => { cancelSelection(); setQuery(value); }} maxLength={256} autoFocus autoCapitalize="words" placeholder="Hotel, apartment, street or area in India" /><Notice message={error}/></View>}
      {mapOpen ? <MapExperience title="Choose the entrance" map={{center:pin,onChooseLocation:setPin,centerIsLocation:true}}
        footer={<Button title="Use this map pin" onPress={() => choose(pin, pinName.trim() || coordinateLocationLabel(pin))} />}>
        <Text style={styles.muted}>Tap the entrance or meeting point.</Text>
        <Field label="Place or building name (optional)" value={pinName} onChange={setPinName} maxLength={200} placeholder="Apartment, hotel or meeting point" />
        <Text style={[styles.muted,{fontSize:11}]}>Selected pin: {pin[1].toFixed(6)}, {pin[0].toFixed(6)}</Text>
        <Button title="Back to location search" secondary onPress={() => setMapOpen(false)} />
      </MapExperience> : <ScrollView testID="location-search-results" style={{flex:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{gap:16,paddingHorizontal:22,paddingBottom:24}}>
      <View style={{ gap: 8 }}>
        {busy && <ActivityIndicator accessibilityLabel="Searching Google Maps locations" color={colors.accent} />}
        {results.map(result => <Pressable key={result.id} accessibilityRole="button" accessibilityLabel={`Select location ${result.address}`} disabled={Boolean(resolving)} onPress={() => { void selectResult(result); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line, gap: 5 }}><Text style={styles.text}>{result.name}</Text><Text style={styles.muted}>{result.address}</Text>{resolving === result.id && <ActivityIndicator accessibilityLabel="Locating selected place" color={colors.accent} />}</Pressable>)}
        {!busy && !error && query.trim().length >= 3 && !results.length && <Text style={styles.muted}>No matching address found. Try the street and area, or choose the building entrance on the map.</Text>}
      </View>
      <Button title={locating ? 'Finding your location…' : 'Use current location'} secondary icon="target" onPress={locate} disabled={locating} />
      <Button title="Choose on map" secondary icon="pin" onPress={() => { Keyboard.dismiss();cancelSelection(); setPin(center); setPinName(query.trim()); setMapOpen(true); }} />
      <Button title="Bangalore (Bengaluru)" secondary onPress={() => choose(bengaluru, 'Bangalore (Bengaluru)')} />
      <Text style={[styles.muted, { fontSize: 11 }]}>Some hotel and apartment names may be missing. Choose on map to set their exact location.</Text>
      <Text accessibilityLabel="Google Maps" style={{ color: colors.text, fontSize: 14, fontWeight: '400' }}>Google Maps</Text>
      <Text style={[styles.muted, { fontSize: 11 }]}>Check the selected pin before booking.</Text>
</ScrollView>}

      <AppFooter />
    </SafeAreaView></KeyboardAvoidingView></Modal>
  </>;
}
