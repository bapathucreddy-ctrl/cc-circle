import { KeyboardAwareScrollView as ScrollView } from '../components/KeyboardAwareScrollView';
import { ServiceLoader as ActivityIndicator } from '../components/ServiceLoader';
import { CirclePicks } from '../components/CirclePicks';
import { serviceImages } from '../lib/servicePresentation';
import { ServiceCraftIcon } from '../components/ServiceCraftIcon';
import { CraftServiceSheet } from './CraftServices';
import { ProfessionalDetails } from '../components/ProfessionalDetails';
import { professionalProfile } from '../lib/professionalProfile';
import { ProfessionalProfileHeader } from '../components/ProfessionalProfileHeader';
import { ProfessionalAvatar } from '../components/ProfessionalAvatar';
import { visibleCategories, serviceCatalog } from '../lib/serviceCatalog';
import { OccasionBanners } from '../components/OccasionBanners';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { createRequestId } from '../lib/requestId';
import DateTimePicker from '../components/DateTimePicker';
import { bookingFees, categories, categoryLabels, errorText, money, type Booking, type Category, type Coordinate, type Professional, type Service } from '../domain';
import { Brand, Button, Card, Chip, EmptyState, Field, GalleryArtwork, GalleryBackdrop, Icon, IconButton, Notice, Segmented, TextButton, ThemeToggle, craftImages, welcomeImages, useTheme } from '../ui';
import { useAvailability, useForegroundRefresh, useResource } from '../hooks';
import * as api from '../lib/api';
import { supabase } from '../lib/supabase';
import { TalentMap } from '../components/TalentMap';
import { currentLocation } from '../lib/currentLocation';
import { coordinateLocationLabel, deviceLocationLabel } from '../lib/deviceLocation';
import { isProfessionalApp } from '../appVariant';
import { InstagramVerificationBadge } from '../components/InstagramVerificationBadge';
import { PortfolioGallery } from '../components/PortfolioGallery';
import { ProfessionalReviews } from '../components/ProfessionalReviews';
import { drivingRoute } from '../lib/routes';
import { LocationPicker } from '../components/LocationPicker';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { BookingCharges } from '../components/BookingCharges';
import { ProfessionalLocation } from '../components/ProfessionalLocation';
import { hasLiveLocation } from '../lib/liveLocation';
import { NotificationBell } from '../components/NotificationCenter';

export function Home({ center, setCenter, locationLabel, onLocationChange, onDiscover, onRequest, onBooking, onBookings }: { center: Coordinate; setCenter: (point: Coordinate) => void; locationLabel: string; onLocationChange: (point: Coordinate, label: string) => void; onDiscover: (category?: Category, now?: boolean, query?: string, serviceKey?: string) => void; onRequest: () => void; onBooking: (booking: Booking) => void; onBookings: () => void }) {

  const { colors, styles } = useTheme(); const { width } = useWindowDimensions(); const wide = width >= 800;
  const [selectedCraft, setSelectedCraft] = useState<Category | null>(null);
  const [timing, setTiming] = useState('now'); const [query, setQuery] = useState('');
  const recent = useResource(api.myBookings, 'mine', 'bookings'); useForegroundRefresh(recent.refresh);
  const upcoming = recent.data?.filter(booking => ['requested', 'accepted', 'en_route', 'arrived'].includes(booking.status)).slice(0, 2) || [];
  const tiles = visibleCategories.map(category => ({ id: category, label: categoryLabels[category], category, accessibilityLabel: 'Find ' + categoryLabels[category].toLowerCase(), onPress: () => setSelectedCraft(category) }));
  const search = () => onDiscover(undefined, timing === 'now', query);
  return <ScrollView contentContainerStyle={{ paddingBottom: 24 }} style={{ backgroundColor: colors.panel }} keyboardShouldPersistTaps="handled">
    <OccasionBanners onChoose={(category, serviceKey) => serviceKey ? onDiscover(category, timing === 'now', undefined, serviceKey) : setSelectedCraft(category)}>
    <View style={styles.between}><Brand compact={!wide} onAccent /><View style={[styles.row, { gap: 8 }]}><NotificationBell /><ThemeToggle /></View></View>
    <View style={{ marginTop: -5 }}><LocationPicker compact foregroundColor="#E9F8F4" center={center} label={locationLabel} onSelect={onLocationChange} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF', borderRadius: 14, marginTop: 2 }}>
      <Icon name="search" size={17} color="#667779" /><TextInput accessibilityLabel="Search your circle" value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" placeholder="Search makeup, photos, reels..." placeholderTextColor="#667779" style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, color: '#102D30', fontSize: 13 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Search nearby professionals" onPress={search} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow" size={17} color="#102D30" /></Pressable>
    </View>
    </OccasionBanners>
    <View style={{ width: '100%', marginTop: -1, paddingTop: 1, backgroundColor: colors.panel }}>
    <View style={[styles.content, { padding: wide ? 24 : 16, paddingTop: 4, gap: 12, paddingBottom: 0 }]}>
    <View style={{ gap: 7, paddingVertical: 0 }}>
      <Text style={{ color: colors.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '600' }}>GOOD PEOPLE. GREAT WORK.</Text>
      <Text style={{ color: colors.text, fontSize: 24, lineHeight: 28, fontWeight: '700', letterSpacing: -.7 }}>Great talent. Close to you.</Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Discover local creatives. Book with confidence.</Text>
    </View>
    <Segmented compact options={[{ id: 'now', label: 'Available now' }, { id: 'schedule', label: 'Schedule' }]} value={timing} onChange={setTiming} />

    <Text style={[styles.heading, { fontSize: 15, marginTop: 4 }]}>Explore services</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
      {[...tiles, { id: 'team', label: 'Event team', category: undefined, accessibilityLabel: 'Build an event team', onPress: onRequest }].map(tile => <Pressable key={tile.id} accessibilityRole="button" accessibilityLabel={tile.accessibilityLabel} onPress={tile.onPress} style={({ pressed }) => ({ width: wide ? '15%' : '31%', gap: 7, alignItems: 'center', opacity: pressed ? .7 : 1 })}>
        <View style={{ width: '100%', height: wide ? 116 : 86, borderRadius: 14, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' }}>
          <ServiceCraftIcon category={tile.category} size={wide ? 88 : 66} />
        </View><Text numberOfLines={2} style={{ color: colors.text, fontSize: 11, lineHeight: 15, textAlign: 'center', minHeight: 30 }}>{tile.label}</Text>
      </Pressable>)}
    </View>
    <CirclePicks onChoose={(category, key) => onDiscover(category, timing === 'now', undefined, key)} />
    <Notice message={recent.error} />
    {upcoming.length > 0 && <><View style={styles.between}><Text style={[styles.heading, { fontSize: 15 }]}>Your bookings</Text><TextButton title="View all" onPress={onBookings} /></View>
      {upcoming.map(booking => <Pressable key={booking.id} accessibilityRole="button" accessibilityLabel={'Open booking ' + booking.service_name} onPress={() => onBooking(booking)} style={[styles.card, styles.between, { padding: 14 }]}><Icon name="calendar" size={20} color={colors.text} /><View style={{ flex: 1, gap: 3 }}><Text style={[styles.text, { fontSize: 13 }]}>{booking.service_name}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{statusLabels[booking.status]}</Text></View><Icon name="chevron" size={17} color={colors.muted} /></Pressable>)}
    </>}
    </View>
    </View>
    <CraftServiceSheet category={selectedCraft} center={center} availableNow={timing === 'now'} onClose={() => setSelectedCraft(null)} onChoose={(category, key) => { setSelectedCraft(null); onDiscover(category, timing === 'now', undefined, key); }} />
  </ScrollView>;
}

function TalentCard({ person, selected, onProfile, onCompare }: { person: Professional; selected: boolean; onProfile: () => void; onCompare: () => void }) {
  const { colors, styles } = useTheme();
  return <Card><View style={styles.between}><View style={[styles.row, { flex: 1, flexWrap: 'nowrap' }]}><ProfessionalAvatar professionalId={person.id} name={person.display_name} size={54} /><View style={{ flex: 1, gap: 4 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={[styles.heading, { flexShrink: 1 }]}>{person.display_name}</Text><InstagramVerificationBadge professionalId={person.id} /></View><Text style={styles.muted}>{person.specialties.slice(0, 3).join(' · ') || categoryLabels[person.category]}</Text><ProfessionalLocation person={person} /></View></View><Image source={craftImages[person.category]} style={{ width: 40, height: 40 }} /></View>
    <View style={styles.divider} /><View style={styles.between}><Text style={[styles.text, { fontWeight: '600' }]}>{person.booking_price_paise != null ? `From ${money(person.booking_price_paise)} / session` : 'View service packages'}</Text><Text style={{ color: person.available_now ? colors.success : colors.muted, fontSize: 11 }}>{person.available_now ? '● Available now' : 'Schedule for later'}</Text></View>
    {person.available_now&&!hasLiveLocation(person)&&<Text style={styles.muted}>Available now · live location not shared</Text>}
    <View style={styles.between}><Chip title={selected ? '✓ Compare' : '+ Compare'} selected={selected} onPress={onCompare} /><Button title="View & book" icon="arrow" onPress={onProfile} /></View>
  </Card>;
}
export function Discover({ center, setCenter, locationLabel, onLocationChange, onProfile, savedOnly = false, userId, shortlist, toggleCompare, onCompare, initialCategory = 'Makeup', initialNow = true, initialQuery = '', serviceKey }: {
  center: Coordinate; setCenter: (point: Coordinate) => void; locationLabel: string; onLocationChange: (point: Coordinate, label: string) => void; onProfile: (p: Professional) => void; savedOnly?: boolean; userId: string; shortlist: Professional[]; toggleCompare: (p: Professional) => void; onCompare: () => void;
  initialCategory?: Category; initialNow?: boolean; initialQuery?: string; serviceKey?: string;
}) {
  const { styles, colors } = useTheme(); const { width } = useWindowDimensions();
  const [category, setCategory] = useState<Category>(initialCategory); const [query, setQuery] = useState(initialQuery); const [search, setSearch] = useState(initialQuery);
  const [radius, setRadius] = useState(15); const [now, setNow] = useState(initialNow); const [showMap, setShowMap] = useState(true); const [budget, setBudget] = useState(''); const [sort, setSort] = useState('nearest');
  const [filtersOpen, setFiltersOpen] = useState(false); const [draftRadius, setDraftRadius] = useState(15); const [draftBudget, setDraftBudget] = useState(''); const [filterError, setFilterError] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 350); return () => clearTimeout(timer); }, [query]);
  const result = useResource(async () => {
    const rows = await api.discover(category, center, search, radius, now, serviceKey && serviceCatalog.find(item => item.key === serviceKey)?.category === category ? serviceKey : undefined);
    if (!savedOnly) return rows;
    const ids = await api.savedIds(userId); return rows.filter(row => ids.includes(row.id));
  }, JSON.stringify([category, center, search, radius, now, savedOnly, userId, serviceKey]), 'discovery');
  useForegroundRefresh(result.refresh, 5000);
  const [,setLocationClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setLocationClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
  const people = (result.data || []).filter(person => !budget || (person.booking_price_paise != null && person.booking_price_paise <= Number(budget) * 100)).sort((a, b) => sort === 'price' ? (a.booking_price_paise ?? Infinity) - (b.booking_price_paise ?? Infinity) : (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
  function resetFilters() { setBudget(''); setRadius(15); setNow(true); setQuery(''); }
  return <View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={result.loading} onRefresh={result.refresh} />}>
    <Text style={styles.title}>{savedOnly ? 'Your creative shortlist.' : serviceCatalog.find(item => item.key === serviceKey && item.category === category)?.label || 'Find your people.'}</Text><LocationPicker center={center} label={locationLabel} onSelect={onLocationChange} />
    <Field label="Search nearby talent" value={query} onChange={setQuery} placeholder="Search a name or specialty" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{visibleCategories.map(role => <Chip key={role} title={categoryLabels[role]} selected={category === role} onPress={() => setCategory(role)} />)}</ScrollView>
    <Segmented options={[{ id: 'map', label: 'Map + list' }, { id: 'list', label: 'List only' }]} value={showMap ? 'map' : 'list'} onChange={id => setShowMap(id === 'map')} />
    {showMap && <TalentMap center={center} professionals={people.filter(person=>hasLiveLocation(person))} onSelect={onProfile} label={`Within ${radius} km · live professional locations`} />}
    <View style={styles.row}><Chip title={`Filters${budget || radius !== 15 ? ' •' : ''}`} onPress={() => { setDraftRadius(radius); setDraftBudget(budget); setFilterError(''); setFiltersOpen(true); }} /><Chip title="Available now" selected={now} onPress={() => setNow(value => !value)} /></View>
    <Notice message={result.error} />{Boolean(result.error) && <Button title="Retry" onPress={result.refresh} secondary />}
    <View style={styles.between}><Text style={styles.heading}>{result.loading ? 'Finding talent…' : `${people.length} ${categoryLabels[category].toLowerCase()}${people.length === 1 ? '' : 's'} nearby`}</Text><TextButton title={sort === 'nearest' ? 'Nearest first ↕' : 'Price: low first ↕'} onPress={() => setSort(value => value === 'nearest' ? 'price' : 'nearest')} /></View>
    {result.loading && <ActivityIndicator color={colors.accent} />}
    {!result.loading && !result.error && !people.length && <EmptyState title={savedOnly ? 'Your shortlist starts here.' : 'No matches just yet.'} message={savedOnly ? 'Save professionals from their profiles, then find them here by category.' : 'Try a wider area or different filters. Real work profiles will appear as professionals join.'} action="Reset filters" onAction={resetFilters} />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{people.map(person => <View key={person.id} style={{ width: width >= 800 ? '48%' : '100%' }}><TalentCard person={person} selected={shortlist.some(p => p.id === person.id)} onProfile={() => onProfile(person)} onCompare={() => toggleCompare(person)} /></View>)}</View>
    <View style={styles.row}><Icon name="shield" size={16} color={colors.muted} /><Text style={styles.muted}>Map pins show fresh GPS locations shared by available professionals. Profiles without live GPS remain in the list for scheduling.</Text></View>
  </ScrollView>
    {shortlist.length > 0 && <View style={[styles.dock, styles.between]}><View><Text style={styles.text}>{shortlist.length} of 3 selected</Text><Text style={styles.muted}>Compare before you book</Text></View><Button title="Compare" onPress={onCompare} disabled={shortlist.length < 2} /></View>}
    <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}><View style={{ flex: 1, backgroundColor: '#00000070', justifyContent: 'center', alignItems: 'center', padding: 24 }}><View style={[styles.card, { width: '100%', maxWidth: 440, gap: 24 }]}><View style={styles.between}><Text style={styles.heading}>Refine your circle</Text><IconButton name="close" label="Close filters" onPress={() => setFiltersOpen(false)} /></View><Text style={styles.label}>Within</Text><View style={styles.row}>{[5, 10, 15].map(km => <Chip key={km} title={`${km} km`} selected={draftRadius === km} onPress={() => setDraftRadius(km)} />)}</View><Field label="Maximum booking price (₹)" value={draftBudget} onChange={setDraftBudget} numeric placeholder="Any price" /><Notice message={filterError} /><Button title="Show matching talent" onPress={() => { if (draftBudget && (!Number.isFinite(Number(draftBudget)) || Number(draftBudget) < 0)) { setFilterError('Enter a valid maximum price.'); return; } setBudget(draftBudget); setRadius(draftRadius); setFiltersOpen(false); }} /><TextButton title="Reset all filters" onPress={() => { resetFilters(); setFiltersOpen(false); }} /></View></View></Modal>
  </View>;
}
export function Profile({ person, userId, onBook, onCompare, selectedForCompare, preferredServiceKey, onReviews }: { person: Professional; userId: string; onBook: (s: Service) => void; onCompare: () => void; selectedForCompare: boolean; preferredServiceKey?: string; onReviews?: () => void }) {
  const details = useResource(() => professionalProfile(person.id), person.id, 'professional-profile');
  const { styles, colors } = useTheme(); const result = useResource(() => api.services(person.id), person.id, 'services'); const saved = useResource(() => api.savedIds(userId), userId, 'saved');
  useForegroundRefresh(details.refresh, 60000);
  useForegroundRefresh(result.refresh, 60000);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = result.data?.find(service => service.id === selectedId) || result.data?.find(service => service.service_key === preferredServiceKey) || result.data?.[0];
  const availability = useAvailability(person.id, selected?.duration_minutes);
  const availableNow = availability.data?.available_now ?? false;
  async function toggle() { setBusy(true); setError(''); try { await api.toggleSaved(userId, person.id, saved.data?.includes(person.id) || false); await saved.refresh(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.between}><Text style={styles.heading}>Professional profile</Text><IconButton name="heart" label={saved.data?.includes(person.id) ? 'Unsave professional' : 'Save professional'} selected={saved.data?.includes(person.id)} disabled={busy || saved.loading || Boolean(saved.error)} onPress={toggle} /></View>
    <ProfessionalProfileHeader person={details.data || person} serviceCount={result.data?.length || 0} />
    <Notice message={error || saved.error || availability.error} />
    <PortfolioGallery professionalId={person.id} />
    <Notice message={details.error} /><ProfessionalDetails person={details.data || person} availability={availability.data?.is_busy ? 'Busy now' : availableNow ? 'Available now' : 'Scheduled sessions'} footer={<TextButton title={selectedForCompare ? 'Remove from compare' : 'Add to compare'} onPress={onCompare} />} />
    <Text style={styles.heading}>Services & sessions</Text><Notice message={result.error} />
    {Boolean(result.error) && <Button title="Retry services" secondary onPress={result.refresh} />}
    {result.loading && <ActivityIndicator color={colors.accent} />}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 3 }} accessibilityRole="radiogroup" accessibilityLabel="Choose a service session">
      {result.data?.map(service => {
        const checked = selected?.id === service.id;
        return <Pressable key={service.id} accessibilityRole="radio" accessibilityLabel={service.name + ', ' + money(bookingFees(service.amount_paise).buyerTotal) + ' per session'} accessibilityState={{ checked }} onPress={() => setSelectedId(service.id)} style={{ width: 168, borderWidth: 2, borderColor: checked ? '#000000' : colors.line, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <Image accessible={false} source={service.service_key && serviceImages[service.service_key] || welcomeImages[person.category]} style={{ width: '100%', height: 126 }} resizeMode="cover" />
          <View style={{ padding: 12, gap: 6 }}><Text numberOfLines={2} style={{ color: '#111111', fontSize: 13, lineHeight: 18, fontWeight: '600', minHeight: 36 }}>{service.name}</Text><Text style={{ color: '#111111', fontSize: 15, fontWeight: '700' }}>{money(bookingFees(service.amount_paise).buyerTotal)}</Text><Text style={{ color: '#666666', fontSize: 11 }}>per session</Text></View>
          {checked && <View accessible={false} style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" color="#FFFFFF" size={13} /></View>}
        </Pressable>;
      })}
    </ScrollView>
    {selected && <PriceBreakdown servicePaise={bookingFees(selected.amount_paise).bookingPrice} bookingFeePaise={bookingFees(selected.amount_paise).buyerFee} totalPaise={bookingFees(selected.amount_paise).buyerTotal} collapsible />}
    {!result.loading && !result.error && !result.data?.length && <EmptyState title="No sessions available" message="This professional is updating their services." />}
    <ProfessionalReviews professionalId={person.id} onViewAll={onReviews} />
  </ScrollView>{selected && <View style={styles.dock}><View style={styles.between}><Text style={[styles.muted, { flex: 1 }]}>{selected.name}</Text><Text style={styles.heading}>{money(bookingFees(selected.amount_paise).buyerTotal)} / session</Text></View><Button title="Book this session" icon="arrow" onPress={() => onBook(selected)} /></View>}</View>;
}

export function BookingForm({ service, person, center, onCreated, onManageProfile }: { service: Service; person: Professional; center: Coordinate; onCreated: (b: Booking) => void; onManageProfile: () => void }) {
  const { styles, colors } = useTheme(); const fees = bookingFees(service.amount_paise);
  const profileName = useResource(api.myDisplayName, 'booking-customer-name');
  const [venue, setVenue] = useState(''); const [point, setPoint] = useState(center); const [notes, setNotes] = useState(''); const [scheduled, setScheduled] = useState(!person.available_now);
  const [date, setDate] = useState(new Date(Date.now() + 3600000)); const [picker, setPicker] = useState<'date' | 'time' | null>(null); const [requestId] = useState(createRequestId); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [locating, setLocating] = useState(false); const [confirmed, setConfirmed] = useState(false);
  const availability = useAvailability(person.id, service.duration_minutes);
  const canBookNow = availability.data?.available_now ?? false;
  useEffect(() => { if (availability.data && !availability.data.available_now) setScheduled(true); }, [availability.data?.available_now]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof drivingRoute>> | null>(null); const [routeError, setRouteError] = useState('');
  const locationVersion = useRef(0);
  async function locate() {
    const version = ++locationVersion.current; setLocating(true); setError('');
    try { const value = await currentLocation(); if (version !== locationVersion.current) return;
      const point:Coordinate=[value.coords.longitude,value.coords.latitude];
      setPoint(point); setConfirmed(true); setVenue(coordinateLocationLabel(point,value.coords.accuracy));
      const address=await deviceLocationLabel(point,value.coords.accuracy);
      if(version===locationVersion.current)setVenue(previous=>previous===coordinateLocationLabel(point,value.coords.accuracy)?address:previous);
    } catch (e) { if (version === locationVersion.current) setError(errorText(e)); }
    finally { if (version === locationVersion.current) setLocating(false); }
  }
  useEffect(() => { void locate(); return () => { locationVersion.current++; }; }, []);
  useEffect(() => {
    setPreview(null); setRouteError(''); if (!confirmed) return;
    const controller = new AbortController();
    const timer = setTimeout(() => { void drivingRoute([person.longitude, person.latitude], point, controller.signal).then(value => {
      if (!controller.signal.aborted) { setPreview(value); if (!value) setRouteError('Driving estimate unavailable.'); }
    }).catch(() => { if (!controller.signal.aborted) setRouteError('Driving estimate unavailable. You can still request this service.'); }); }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [point[0], point[1], confirmed, person.longitude, person.latitude]);
  async function submit() { setBusy(true); setError(''); try { if (venue.trim().length < 5) throw new Error('Enter the venue address and confirm its pin on the map.'); if (!confirmed) throw new Error('Use your current location or tap the map to confirm your venue pin.'); if (scheduled && date.getTime() <= Date.now()) throw new Error('Choose a future date and time.'); if (profileName.loading || profileName.error || !profileName.data || profileName.data.trim().length < 2) throw new Error('Add your name in your Circle profile before booking.'); const booking = await api.requestBooking(service, (scheduled ? date : new Date(Date.now() + 60000)).toISOString(), venue, point, notes, requestId); onCreated(booking); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={[styles.content, { gap: 16 }]} keyboardShouldPersistTaps="handled"><Text style={styles.eyebrow}>BOOK {categoryLabels[person.category]}</Text><TalentMap centerIsLocation={!confirmed} center={confirmed ? [person.longitude, person.latitude] : point} professionals={[person]} destination={confirmed ? point : undefined} route={preview?.coordinates} onChooseLocation={value => { locationVersion.current++; setLocating(false); setPoint(value); setConfirmed(true); setVenue(previous => !previous || previous === 'Current location' ? 'Pinned location' : previous); }} height={400} label="Confirm your service location" distanceLabel={preview ? `${(preview.distanceMeters / 1000).toFixed(1)} km drive` : undefined} />
    <Card><Text style={styles.label}>Booked as</Text><Text style={styles.heading}>{profileName.loading ? 'Loading profile…' : profileName.data || 'Add your name to your profile'}</Text><Text style={styles.muted}>Your customer name comes from your Circle profile.</Text><TextButton title="Edit name in Circle" onPress={onManageProfile} /><Notice message={profileName.error} /><View style={styles.between}><Text style={styles.heading}>Where do you need them?</Text><Icon name="pin" color={colors.accent} /></View><LocationPicker center={point} label={venue || 'Choose service location'} onSelect={(value, label) => { locationVersion.current++; setLocating(false); setPoint(value); setVenue(label); setConfirmed(true); }} /><Button title={locating ? 'Finding your location…' : 'Use current location'} secondary icon="target" onPress={locate} disabled={locating} /><Field label="Service location" value={venue} onChange={setVenue} placeholder="Venue, street and city" /><Text style={styles.muted}>{confirmed ? 'Venue pin confirmed · add building and access details below.' : 'Choose your current location or tap the map to confirm a venue.'}</Text>
      <View style={styles.between}><Text style={styles.heading}>{person.display_name}</Text><Text style={{ color: colors.accent }}>{preview ? `${Math.ceil(preview.durationSeconds / 60)} min drive` : 'Route estimate'}</Text></View><Text style={styles.muted}>{preview ? `${(preview.distanceMeters / 1000).toFixed(1)} km by road · estimate from their service area; live navigation starts with the journey.` : routeError || (confirmed ? 'Finding a driving route…' : 'Confirm the venue to see driving distance.')}</Text>
      <Notice message={availability.error} /><Segmented options={[...(canBookNow ? [{ id: 'now', label: 'Now' }] : []), { id: 'schedule', label: 'Schedule' }]} value={scheduled ? 'schedule' : 'now'} onChange={id => setScheduled(id === 'schedule')} />{!canBookNow && <Text style={styles.muted}>{availability.data?.is_busy ? 'Busy with another booking or blocked time. Choose a future slot; availability is checked when you request.' : 'This professional accepts scheduled bookings.'}</Text>}
      {scheduled && <><View style={styles.row}><Button title={date.toLocaleDateString()} icon="calendar" secondary onPress={() => setPicker('date')} /><Button title={date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} secondary onPress={() => setPicker('time')} /></View>{picker && <DateTimePicker value={date} mode={picker} minimumDate={new Date()} onChange={(_, value) => { setPicker(null); if (value) setDate(value); }} />}</>}
      <View style={styles.divider} /><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.heading}>{service.name}</Text><Text style={styles.muted}>{person.display_name}</Text></View><Text style={[styles.heading, { color: colors.accent }]}>{money(fees.buyerTotal)}</Text></View><PriceBreakdown servicePaise={fees.bookingPrice} bookingFeePaise={fees.buyerFee} totalPaise={fees.buyerTotal} /><View style={styles.row}><Icon name="wallet" size={17} color={colors.muted} /><Text style={styles.muted}>Pay after acceptance, before service</Text></View>
      <Field label="Instructions (optional)" value={notes} onChange={setNotes} multiline placeholder="Scope, style and special requirements" /><Text style={[styles.muted, { fontSize: 11 }]}>Only booking participants can see your venue. Final availability is confirmed by the professional.</Text>
    </Card><Notice message={error} /></ScrollView><View style={styles.dock}><View style={styles.between}><Text style={styles.muted}>{scheduled ? 'Scheduled service' : 'Book now'}</Text><Text style={styles.heading}>{money(fees.buyerTotal)}</Text></View><Button title={scheduled ? 'Request scheduled booking' : 'Request booking'} icon="arrow" onPress={submit} busy={busy} /></View></View>;
}
export const statusLabels: Record<Booking['status'], string> = { requested: 'Awaiting acceptance', accepted: 'Accepted', en_route: 'On the way', arrived: 'Arrived', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' };
export function Bookings({ onOpen }: { onOpen: (booking: Booking) => void }) {
  const { styles, colors } = useTheme(); const [tab, setTab] = useState('upcoming'); const result = useResource(api.myBookings, 'mine', 'bookings');
  useEffect(() => { const channel = supabase.channel('my-booking-list').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void result.refresh(); }).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [result.refresh]);
  const bookings = result.data?.filter(booking => tab === 'upcoming' ? ['requested', 'accepted', 'en_route', 'arrived'].includes(booking.status) : ['completed', 'declined', 'cancelled'].includes(booking.status));
  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={result.loading} onRefresh={result.refresh} />}><Text style={styles.title}>Plans coming{'\n'}to life.</Text><Segmented options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past bookings' }]} value={tab} onChange={setTab} /><Notice message={result.error} />{Boolean(result.error) && <Button title="Retry bookings" secondary onPress={result.refresh} />}{result.loading && <ActivityIndicator color={colors.accent} />}
    {bookings?.map(booking => <Card key={booking.id}><View style={styles.between}><Text style={{ color: colors.accent, fontSize: 11, fontWeight: '600' }}>{statusLabels[booking.status]}</Text><Text style={styles.muted}>#{booking.id.slice(0, 8)}</Text></View><Text style={styles.heading}>{booking.service_name}</Text><Text style={styles.muted}>{new Date(booking.starts_at).toLocaleString()}</Text><Text style={styles.muted}>{booking.venue}</Text><View style={styles.between}><BookingCharges booking={booking} professional={isProfessionalApp}/>{!isProfessionalApp && <Text style={styles.muted}>{booking.paid_at ? 'Paid' : 'Payment pending'}</Text>}</View><Button title={['en_route', 'arrived'].includes(booking.status) ? 'Track booking' : 'View booking'} icon="arrow" onPress={() => onOpen(booking)} /></Card>)}
    {!result.loading && !result.error && !bookings?.length && <EmptyState icon="calendar" title={tab === 'upcoming' ? 'Room for your next project.' : 'Your story starts here.'} message={tab === 'upcoming' ? 'New requests and upcoming collaborations will appear here.' : 'Completed and cancelled bookings will appear here.'} />}
  </ScrollView>;
}
export function Comparison({ people, onProfile }: { people: Professional[]; onProfile: (p: Professional) => void }) {
  const { styles } = useTheme(); const { width } = useWindowDimensions();
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Find your best fit.</Text><Text style={styles.muted}>Compare work, prices and availability, then explore their services.</Text><View style={{ flexDirection: width >= 800 ? 'row' : 'column', gap: 16 }}>{people.map(person => <View key={person.id} style={{ flex: 1 }}><Card><Text style={styles.heading}>{person.display_name}</Text><Text style={styles.eyebrow}>{categoryLabels[person.category]}</Text><Text style={styles.text}>{person.specialties.join(' · ')}</Text><Text style={styles.muted}>{person.available_now ? 'Available now' : 'Schedule for later'}{person.distance_km != null ? ` · ${person.distance_km.toFixed(1)} km away` : ''}</Text>{person.booking_price_paise != null && <Text style={styles.heading}>From {money(person.booking_price_paise)}</Text>}<Text style={styles.muted}>{person.bio}</Text><Button title="View services & portfolio" icon="arrow" onPress={() => onProfile(person)} /></Card></View>)}</View></ScrollView>;
}
