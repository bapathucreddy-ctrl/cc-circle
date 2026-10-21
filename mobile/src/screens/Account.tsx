import { KeyboardAwareScrollView as ScrollView } from '../components/KeyboardAwareScrollView';
import { ServiceLoader as ActivityIndicator } from '../components/ServiceLoader';
import { FeePresets } from '../components/FeePresets';
import { ProfessionalDetails } from '../components/ProfessionalDetails';
import { ProfessionalProfileHeader } from '../components/ProfessionalProfileHeader';
import { ProfessionalReviews } from '../components/ProfessionalReviews';
import { ProfessionalServices, ProfessionalServiceSummary, ServiceTypePicker } from '../components/ProfessionalServices';
import { services as loadServices } from '../lib/api';
import { visibleCategories, servicesForCategory } from '../lib/serviceCatalog';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import DateTimePicker from '../components/DateTimePicker';
import { categories, categoryLabels, errorText, money, type Category, type Coordinate, type Professional } from '../domain';
import { questionnaires } from '../questionnaires';
import { stopProfessionalLocation } from '../lib/professionalLocation';
import { unregisterNotifications } from '../lib/notifications';
import { releaseAppSession } from '../lib/appSessions';
import { professionalProfile } from '../lib/professionalProfile';
import { useAvailability, useResource } from '../hooks';
import { isProfessionalApp } from '../appVariant';
import { PhoneVerificationCard } from '../components/PhoneVerificationCard';
import { supabase } from '../lib/supabase';
import { MapLocationField } from '../components/MapLocationField';
import { myDisplayName, saveDisplayName } from '../lib/api';
import { InstagramVerificationBadge } from '../components/InstagramVerificationBadge';
import { PortfolioManager } from '../components/PortfolioManager';
import { LegalLinks } from '../components/LegalLinks';
import { loadPortfolio } from '../lib/portfolio';
import { myRegistration } from '../lib/registration';
import { Button, Card, Chip, EmptyState, Field, Notice, Segmented, useTheme } from '../ui';

async function signOutOfApp() {
  await unregisterNotifications().catch(() => {});
  if (isProfessionalApp) await stopProfessionalLocation().catch(() => {});
  await releaseAppSession().catch(() => {});
  return supabase.auth.signOut({ scope: 'local' });
}
type Answer = string | string[];
type AccountProps = { userId: string; onJoin: () => void; onSaved: () => void; onBookings: () => void; onReviews?: () => void };
export function Account(props: AccountProps) {
  return isProfessionalApp ? <ProfessionalAccount {...props} /> : <CustomerAccount {...props} />;
}
function CustomerAccount({ onSaved, onBookings }: AccountProps) {
  const { styles } = useTheme(); const [error, setError] = useState('');
  const profile = useResource(myDisplayName, 'customer-name');
  const [name, setName] = useState(''); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const edited = useRef(false);
  useEffect(() => { if (!edited.current && profile.data !== null) setName(profile.data); }, [profile.data]);
  async function saveName() { setSaving(true); setError(''); setSaved(false); try { await saveDisplayName(name); setSaved(true); } catch (e) { setError(errorText(e)); } finally { setSaving(false); } }
  return <ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>CIRCLE · CUSTOMER</Text><Text style={styles.title}>Your circle.</Text><Notice message={error} />
    <Card><Text style={styles.heading}>Your full name</Text><Text style={styles.muted}>Your booked professional sees your name in bookings and messages.</Text><Notice message={profile.error} /><Field label="Full name" value={name} onChange={value => { edited.current = true; setName(value); setSaved(false); }} maxLength={120} autoComplete="name" /><Button title="Save full name" onPress={saveName} busy={saving} />{saved && <Text style={styles.muted}>Name saved.</Text>}</Card>
    <Button title="My bookings" onPress={onBookings} /><Button title="Saved professionals" secondary onPress={onSaved} />
    <PhoneVerificationCard />
    <LegalLinks account />
    <Button title="Sign out" secondary onPress={() => { void signOutOfApp().then(({ error }) => { if (error) setError(error.message); }); }} />
  </ScrollView>;
}
function ProfessionalAccount({ userId, onJoin, onBookings, onReviews }: AccountProps) {
  const { styles, colors } = useTheme();
  const result = useResource(() => professionalProfile(userId), userId, 'professional-profile');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [workCount, setWorkCount] = useState<number | undefined>();
  const profileServices = useResource(() => loadServices(userId), userId, 'services');
  const liveAvailability = useAvailability(userId);
  const [blockedDate, setBlockedDate] = useState(new Date(Date.now() + 86400000)); const [picker, setPicker] = useState(false);
  const [availabilityNote, setAvailabilityNote] = useState('');
  const availabilityPending = useRef(false);
  async function availability(nextOnline: boolean) {
    if (availabilityPending.current || busy || !result.data) return;
    availabilityPending.current = true;
    setBusy(true); setError('');
    try {
      const { error } = await supabase.from('professionals').update({ available_now: nextOnline }).eq('id', userId);
      if (error) throw error;
      try { if (!nextOnline) await stopProfessionalLocation(userId); }
      finally { await Promise.all([result.refresh(), liveAvailability.refresh()]); }
    } catch (e) { setError(errorText(e)); } finally { availabilityPending.current = false; setBusy(false); }
  }
  async function blockDay() {
    setBusy(true); setError(''); setAvailabilityNote('');
    try {
      const start = new Date(blockedDate); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      const { error } = await supabase.from('availability_blocks').insert({ professional_id: userId, starts_at: start.toISOString(), ends_at: end.toISOString() });
      if (error) throw error;
      await liveAvailability.refresh();
      setAvailabilityNote(`${start.toLocaleDateString()} is marked unavailable.`);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={result.loading} onRefresh={() => { void result.refresh(); }} />}>
    <Notice message={error || result.error} />
    <Notice message={liveAvailability.error} />
    {result.data ? <ProfessionalProfileHeader person={result.data} workCount={workCount} serviceCount={profileServices.data?.length || 0} owner online={Boolean(result.data.available_now)} availabilityBusy={busy} onAvailabilityChange={nextOnline => { void availability(nextOnline); }} onEdit={onJoin} onSignOut={() => { void signOutOfApp().then(({ error }) => { if (error) setError(error.message); }); }} /> : <><Text style={styles.title}>Your profile</Text><Button title="Create professional profile" onPress={onJoin} /></>}
    <PortfolioManager userId={userId} onCountChange={setWorkCount} gridFirst afterGallery={<><ProfessionalServiceSummary items={profileServices.data || []} onManage={onJoin} /><Notice message={profileServices.error} />{result.data && <ProfessionalDetails person={result.data} />}<ProfessionalReviews professionalId={userId} onViewAll={onReviews} /></>} />
    {result.data && <>
      <Card><Text style={styles.heading}>Availability calendar</Text><Text style={styles.muted}>Block a date to prevent new bookings.</Text>
        <Button title={blockedDate.toLocaleDateString()} secondary onPress={() => setPicker(true)} />
        {picker && <DateTimePicker mode="date" value={blockedDate} minimumDate={new Date()} onChange={(_, date) => { setPicker(false); if (date) setBlockedDate(date); }} />}
        <Button title="Mark this day unavailable" onPress={blockDay} busy={busy} />
        {Boolean(availabilityNote) && <Text accessibilityLiveRegion="polite" style={styles.muted}>{availabilityNote}</Text>}
      </Card>

    </>}
    <LegalLinks account />

  </ScrollView>;
}

export function Join({ userId, center, onDone }: { userId: string; center: Coordinate; onDone: () => void }) {
  const { styles, colors } = useTheme();
  const [category, setCategory] = useState<Category>('Makeup'); const [name, setName] = useState(''); const [city, setCity] = useState('Bengaluru');
  const [bio, setBio] = useState(''); const [specialties, setSpecialties] = useState(''); const [point, setPoint] = useState(center);
  const [serviceName, setServiceName] = useState(''); const [price, setPrice] = useState(''); const [duration, setDuration] = useState('60');
  const [portfolio, setPortfolio] = useState(''); const [consent, setConsent] = useState(false);
  const [mediaCount, setMediaCount] = useState(0);
  const importedWork = useResource(() => loadPortfolio(userId), userId);
  useEffect(() => { if (importedWork.data) setMediaCount(importedWork.data.media.filter(item => !item.needsReview).length); }, [importedWork.data]);
  const [section, setSection] = useState(-1); const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const draftQueue = useRef<Promise<void>>(Promise.resolve());
  const publishing = useRef(false);
  const existing = useResource(async () => {
    const registration = await myRegistration();
    const { data: draft, error: draftError } = await supabase.from('professional_drafts').select('draft').eq('professional_id', userId).maybeSingle();
    if (draftError) throw draftError;
    const { data: profile, error } = await supabase.from('professionals').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (!profile) return { profile: null, privateData: null, service: null, draft: draft?.draft, professionalName: registration.professional_name };
    const { data: privateData, error: privateError } = await supabase.from('professional_private_details').select('details').eq('professional_id', userId).maybeSingle();
    if (privateError) throw privateError;
    const { data: packages, error: serviceError } = await supabase.from('services').select('*').eq('professional_id', userId).eq('active', true).limit(1);
    if (serviceError) throw serviceError;
    return { profile, privateData, service: packages?.[0], draft: draft?.draft, professionalName: registration.professional_name };
  }, userId);
  const [loaded, setLoaded] = useState(false);
  const scroll = useRef<import('react-native').ScrollView>(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [section]);
  // Hydrate once; edits are never overwritten by later refreshes.
  useEffect(() => { if (existing.data && !loaded) {
    const { profile, privateData, service, draft, professionalName } = existing.data;
    if (draft && typeof draft === 'object' && categories.includes(draft.category)) {
      setName(professionalName || profile?.display_name || ''); setCity(draft.city || 'Bengaluru'); setCategory(draft.category); setBio(draft.bio || '');
      setSpecialties(draft.specialties || ''); setPoint(Array.isArray(draft.point) && draft.point.length === 2 ? draft.point : center);
      setPortfolio(draft.portfolio || ''); setAnswers(draft.answers || {}); setServiceName(draft.serviceName || '');
      setPrice(draft.price || ''); setDuration(Number.isInteger(Number(draft.duration)) && Number(draft.duration) >= 15 && Number(draft.duration) <= 1440 ? String(draft.duration) : '60'); setSection(Number.isInteger(draft.section) ? Math.max(-1, Math.min(questionnaires[draft.category as Category].length + 2, draft.section)) : -1);
      setServiceId(service?.id || null); setLoaded(true); return;
    }
    if (!profile) { setName(professionalName); setLoaded(true); return; }
    setName(profile.display_name); setCity(profile.city); setCategory(profile.category); setBio(profile.bio);
    setSpecialties(profile.specialties.join(', ')); setPoint([Number(profile.longitude), Number(profile.latitude)]);
    setPortfolio(profile.portfolio_urls.join('\n')); setAnswers({ ...profile.public_specs, ...privateData?.details });
    if (service) { setServiceId(service.id); setServiceName(service.name); setPrice(String(service.amount_paise / 100)); setDuration(String(service.duration_minutes)); }
    setLoaded(true);
  } }, [existing.data, loaded]);
  useEffect(() => {
    if (!loaded || publishing.current) return;
    const draft = { category, name, city, bio, specialties, point, serviceName, price, duration, portfolio, answers, section };
    const timer = setTimeout(() => {
      draftQueue.current = draftQueue.current.then(async () => {
        if (publishing.current) return;
        const { error } = await supabase.from('professional_drafts').upsert({ professional_id: userId, draft });
        if (error) setError('Unable to save your signup draft. Check your connection.');
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [loaded, userId, category, name, city, bio, specialties, point, serviceName, price, duration, portfolio, answers, section]);
  function update(id: string, value: Answer) { setAnswers(previous => ({ ...previous, [id]: value })); }
  const sections = questionnaires[category];
  function validateSection(index: number) {
    const fields = sections[index]?.fields || [];
    for (const field of fields) {
      const answer = answers[field.id];
      if (field.required && (!answer || !answer.length)) throw new Error(`Please answer: ${field.label}`);
      if (field.type === 'number' && typeof answer === 'string' && answer &&
        (!Number.isFinite(Number(answer)) || Number(answer) < (field.min ?? -Infinity) || Number(answer) > (field.max ?? Infinity))) throw new Error(`Check the value for ${field.label}.`);
    }
  }
  function next() {
    setError('');
    try {
      if (section < 0 && (city.trim().length < 2 || bio.trim().length < 20)) throw new Error('Add a city and an introduction of at least 20 characters.');
      if (section >= 0 && section < sections.length) validateSection(section);
      if (section === sections.length && existing.data?.profile?.category !== category) validateService();
      if (section === sections.length + 1) validatePortfolio();
      setSection(value => value + 1);
    } catch (e) { setError(errorText(e)); }
  }
  function validateService() {
    const amount = Number(price) * 100; const minutes = Number(duration);
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount % 100 !== 0 || amount < 10000 || amount > 100000000 || !Number.isInteger(minutes) || minutes < 15 || minutes > 1440) throw new Error('Choose a whole-rupee net payout from ₹100 to ₹10,00,000 and a duration of 15–1440 minutes.');
    if (serviceName.trim().length < 2) throw new Error('Enter your service name.');
    if (visibleCategories.includes(category) && !servicesForCategory(category).some(item => item.label === serviceName)) throw new Error('Choose a session service for this craft.');
  }
  function validatePortfolio() {
    if (!mediaCount || !consent) throw new Error('Upload at least one approved work photo and confirm your publishing consent.');
    return [];
  }
  async function save() {
    setError(''); setBusy(true);
    try {
      if (existing.error || existing.loading) throw new Error('Wait for your existing profile to load, or retry loading it.');
      for (let i = 0; i < sections.length; i++) validateSection(i);
      if (city.trim().length < 2 || bio.trim().length < 20) throw new Error('Add a city and an introduction of at least 20 characters.');
      if (existing.data?.profile?.category !== category) validateService(); const links = validatePortfolio();
      const amount = Number(price) * 100; const minutes = Number(duration);
      const privateIds = new Set(sections.flatMap(s => s.fields.filter(f => f.privateField ||
        (category === 'Actor' && (s.title.includes('Casting') || s.title.includes('Wardrobe')))).map(f => f.id)));
      // Actor fitting information and consent/preferences remain owner-only by default.
      if (category === 'Actor') for (const id of ['clothing-size', 'shoe-size', 'hair', 'fitting-notes', 'share-fitting', 'boundaries', 'access-needs']) privateIds.add(id);
      const publicSpecs = Object.fromEntries(Object.entries(answers).filter(([id]) => !privateIds.has(id)));
      const privateDetails = Object.fromEntries(Object.entries(answers).filter(([id]) => privateIds.has(id)));
      publishing.current = true;
      await draftQueue.current;
      let sessionToSave = { id: serviceId, name: serviceName.trim(), amount_paise: amount, duration_minutes: minutes };
      if (existing.data?.profile && existing.data.profile.category !== category) sessionToSave.id = null;
      if (existing.data?.profile?.category === category) {
        const current = await loadServices(userId); const primary = current.find(service => service.id === serviceId) || current[0];
        if (!primary) throw new Error('Add at least one session service before saving.');
        sessionToSave = { id: primary.id, name: primary.name, amount_paise: primary.amount_paise, duration_minutes: primary.duration_minutes };
      }
      const { error } = await supabase.rpc('save_professional_profile', {
        p_profile: { display_name: name.trim(), category, city: city.trim(), bio: bio.trim(),
          specialties: specialties.split(',').map(s => s.trim()).filter(Boolean), longitude: point[0], latitude: point[1],
          portfolio_urls: links, public_specs: publicSpecs },
        p_private: privateDetails, p_service: sessionToSave,
      });
      if (error) throw error; onDone();
    } catch (e) { publishing.current = false; setError(errorText(e)); } finally { setBusy(false); }
  }
  const step = section < 0 ? 0 : section < sections.length ? 1 : section - sections.length + 2;
  const stepLabels = ['Craft', 'Details', 'Pricing', 'Portfolio', 'Review'];
  if (!loaded) return <View style={styles.content}><Text style={styles.heading}>Preparing your profile…</Text><Notice message={existing.error} />{existing.error ? <Button title="Retry profile" onPress={existing.refresh} /> : <ActivityIndicator color={colors.accent} />}</View>;
  return <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: 'row', gap: 6 }}>{stepLabels.map((label, index) => <View key={label} style={{ flex: 1, gap: 8 }}><View style={{ height: 3, backgroundColor: index <= step ? colors.accent : colors.line, borderRadius: 3 }} /><Text style={{ fontSize: 10, color: index === step ? colors.accent : colors.muted }}>{label}</Text></View>)}</View>
    <Text style={styles.eyebrow}>STEP {step + 1} OF 5{section >= 0 && section < sections.length ? ` · QUESTION PAGE ${section + 1} OF ${sections.length}` : ''}</Text>
    <Text style={styles.title}>{section < 0 ? 'Choose your craft.' : section < sections.length ? sections[section]!.title : section === sections.length ? 'Set your terms.' : section === sections.length + 1 ? 'Show your work.' : 'Ready for your circle?'}</Text>
    <Notice message={error || existing.error} />
    {section < 0 && <><View style={styles.row}>{visibleCategories.map(role => <Chip key={role} title={categoryLabels[role]} selected={category === role} onPress={() => { if (category !== role) { setCategory(role); setAnswers({}); } }} />)}</View>
      <View style={{ gap: 4 }}><Text style={styles.label}>Public username</Text><Text style={styles.text}>{name || 'Assigned when you publish'}</Text></View><Field label="Base city" value={city} onChange={setCity} />
      <Field label="Professional introduction" value={bio} onChange={setBio} multiline /><Field label="Specialties (comma separated)" value={specialties} onChange={setSpecialties} />
      <MapLocationField center={point} onChooseLocation={setPoint} label="Choose service area on map" /><Text style={styles.muted}>Your public location is rounded to an approximate service area.</Text>
      <Button title="Continue to professional details" icon="arrow" onPress={next} /></>}
    {section >= 0 && section < sections.length && <><Text style={styles.muted}>{sections[section]!.description}</Text>
      {sections[section]!.fields.map(field => <Card key={field.id}><Text style={styles.text}>{field.label}{field.required ? ' *' : ''}</Text>
        {field.privateField && <Text style={styles.muted}>Optional · private fitting detail</Text>}
        {['select', 'multi'].includes(field.type) ? <View style={styles.row}>{field.options?.map(option => {
          const answer = answers[field.id]; const selected = field.type === 'multi' ? Array.isArray(answer) && answer.includes(option) : answer === option;
          return <Pressable key={option} accessibilityRole={field.type === 'multi' ? 'checkbox' : 'radio'} accessibilityState={{ checked: selected }} style={[styles.chip, selected && styles.chipActive]} onPress={() => {
            if (field.type === 'multi') { const list = Array.isArray(answer) ? answer : []; update(field.id, selected ? list.filter(v => v !== option) : [...list, option]); }
            else update(field.id, selected ? '' : option);
          }}><Text style={{ color: selected ? colors.accent : colors.text, fontSize: 12 }}>{option}</Text></Pressable>;
        })}</View> : <Field label={field.hint || (field.required ? 'Required' : 'Optional')} value={typeof answers[field.id] === 'string' ? answers[field.id] as string : ''}
          onChange={value => update(field.id, value)} numeric={field.type === 'number'} multiline={field.type === 'textarea'} />}</Card>)}
      <Button title="Continue" onPress={next} /><Button title="Previous section" secondary onPress={() => setSection(value => value - 1)} /></>}
    {section === sections.length && <>{existing.data?.profile?.category === category ? <ProfessionalServices userId={userId} category={category} /> : <><Text style={styles.muted}>Set what you receive per session.</Text><ServiceTypePicker category={category} value={serviceName} onChoose={(_, label) => setServiceName(label)} /><Field label="Your earnings per session (₹)" value={price} onChange={setPrice} numeric placeholder="e.g. 5000" />
      <FeePresets value={price} onChange={setPrice} />
      {Number(price) >= 100 && <Card><Text style={styles.label}>Your earnings</Text><Text style={styles.heading}>{money(Number(price) * 100)}</Text></Card>}
      </>}<Button title="Continue to portfolio" icon="arrow" onPress={next} /><Button title="Back to details" secondary onPress={() => setSection(sections.length - 1)} /></>}
    {section === sections.length + 1 && <><PortfolioManager userId={userId} onCountChange={setMediaCount} />
      <Button title={consent ? 'Portfolio publishing consent ✓' : 'Allow these work samples on my public profile'} secondary onPress={() => setConsent(value => !value)} />
      <Text style={styles.muted}>Customers see your professional name and work samples. Only publish work you own and have permission to show.</Text>
      <Button title="Review my profile" icon="arrow" onPress={next} /><Button title="Back to pricing" secondary onPress={() => setSection(sections.length)} /></>}
    {section >= sections.length + 2 && <><Card><Text style={styles.heading}>{name}</Text><Text style={styles.muted}>{categoryLabels[category]} · {city}</Text><Text style={styles.text}>{bio}</Text><Button title="Edit basic profile" secondary onPress={() => setSection(-1)} /></Card><Card><Text style={styles.heading}>{serviceName}</Text><Text style={styles.text}>{money(Number(price) * 100)} / session · Your earnings</Text><Text style={styles.muted}>{Object.values(answers).filter(value => value.length).length} professional details answered.</Text><Button title="Edit service" secondary onPress={() => setSection(sections.length)} /></Card><Card><Text style={styles.heading}>Approved portfolio</Text><Text style={styles.muted}>{portfolio}</Text><Text style={styles.muted}>Casting and fitting details stay private.</Text><Button title="Edit portfolio & consent" secondary onPress={() => setSection(sections.length + 1)} /></Card>{!consent && <Text style={styles.muted}>Confirm publishing consent in the Portfolio step before publishing.</Text>}<Button title="Publish professional profile" icon="arrow" onPress={save} busy={busy} disabled={existing.loading || Boolean(existing.error) || !consent} /></>}
  </ScrollView>;
}
