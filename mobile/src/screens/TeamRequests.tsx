import { KeyboardAwareScrollView as ScrollView } from '../components/KeyboardAwareScrollView';
import { ServiceLoader as ActivityIndicator } from '../components/ServiceLoader';
import { ServiceCraftIcon } from '../components/ServiceCraftIcon';
import { visibleCategories } from '../lib/serviceCatalog';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { bengaluru, categories, categoryLabels, errorText, money, type Booking, type Category, type Coordinate, type Professional } from '../domain';
import { useForegroundRefresh, useResource } from '../hooks';
import { Button, Card, Field, Icon, IconButton, Notice, Segmented, TextButton, useTheme } from '../ui';
import { AppearanceSelect } from '../components/AppearanceSelect';
import DateTimePicker from '../components/DateTimePicker';
import { LocationPicker } from '../components/LocationPicker';
import { TalentMap } from '../components/TalentMap';
import { createRequestId } from '../lib/requestId';
import { supabase } from '../lib/supabase';
import { services } from '../lib/api';
import * as team from '../lib/teamRequests';

type CustomerProps = { userId: string; center?: Coordinate; initialEventId?: string; onBooking: (booking: Booking) => void; onProfile: (person: Professional) => void };

export function TeamRequests({ userId, center=bengaluru, initialEventId, onBooking, onProfile }: CustomerProps) {
  const { styles } = useTheme();
  const result = useResource(team.teamEvents, userId);
  useForegroundRefresh(result.refresh);
  const [tab, setTab] = useState(initialEventId ? 'events' : 'create');
  const [selected, setSelected] = useState<string | null>(initialEventId || null);
  useEffect(() => { if (initialEventId) { setTab('events'); setSelected(initialEventId); } }, [initialEventId]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const events = (result.data || []).filter(event => event.is_owner && !deletedIds.includes(event.id));
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={result.loading} onRefresh={() => { void result.refresh(); }} />}>
    <Text style={styles.title}>Build your event team.</Text>
    <Segmented value={tab} onChange={setTab} options={[{ id: 'create', label: 'New event' }, { id: 'events', label: `My events (${events.length})` }]} />
    <Notice message={result.error} />
    {tab === 'create' ? <TeamRequestForm center={center} onPosted={id => { setSelected(id); setTab('events'); void result.refresh(); }} /> : <>
      <Text style={styles.muted}>Choose each member of your team. Weddings use agreed hourly rates, with payment after verified service completion. Other events use fixed-price bookings.</Text>
      {!result.loading && !events.length && <Text style={styles.text}>Your posted events will appear here.</Text>}
      {events.map(event => <View key={event.id} style={{ gap: 14 }}><EventSummary event={event} />
        <Button title={selected === event.id ? 'Hide professional applications' : 'Review professional applications'} secondary onPress={() => setSelected(selected === event.id ? null : event.id)} />
        {selected === event.id && <Applicants event={event} onBooking={onBooking} onProfile={onProfile} onChanged={result.refresh} />}
        <DeleteEvent event={event} onDeleted={() => { setDeletedIds(previous => [...previous,event.id]); setSelected(previous => previous === event.id ? null : previous); void result.refresh(); }} />
      </View>)}
    </>}
  </ScrollView>;
}

function DeleteEvent({ event, onDeleted }: { event: team.TeamEvent; onDeleted: () => void }) {
  const { styles } = useTheme();
  const [confirming,setConfirming]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function remove() {
    if(busy)return;setBusy(true);setError('');
    try { await team.deleteTeamEvent(event.id); onDeleted(); }
    catch(e){setError(errorText(e));}
    finally{setBusy(false);}
  }
  return <View style={{gap:10}}><Notice message={error}/>{confirming ? <Card>
    <Text style={styles.heading}>Delete “{event.title}”?</Text>
    <Text style={styles.text}>This removes the event and its applications. Existing bookings stay in My bookings and must be managed separately.</Text>
    <Button title="Yes, delete event" onPress={remove} busy={busy}/>
    <Button title="Keep event" secondary disabled={busy} onPress={()=>{setConfirming(false);setError('');}}/>
  </Card> : <Button title="Delete event" secondary onPress={()=>setConfirming(true)}/>}</View>;
}

export function TeamRequestForm({ center, onPosted }: { center: Coordinate; onPosted: (id: string) => void }) {
  const { styles, colors } = useTheme();
  const [title, setTitle] = useState(''); const [requirements, setRequirements] = useState('');
  const [billingMode,setBillingMode]=useState<'fixed'|'hourly'>('hourly');const [plannedHours,setPlannedHours]=useState('8');
  const [roles, setRoles] = useState<team.TeamRole[]>([]);
  const [point, setPoint] = useState<Coordinate>(center); const [venue, setVenue] = useState(''); const [confirmed, setConfirmed] = useState(false);
  useEffect(()=>{if(!venue&&!confirmed)setPoint(center);},[center[0],center[1],venue,confirmed]);
  const [date, setDate] = useState(() => { const next = new Date(Date.now() + 86400000); next.setHours(10, 0, 0, 0); return next; });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [requestId] = useState(createRequestId); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  function adjustRole(category: Category, delta: number) {
    setRoles(previous => {
      const count = previous.find(role => role.category === category)?.quantity || 0;
      const quantity = Math.max(0, Math.min(20, count + delta));
      if (!quantity) return previous.filter(role => role.category !== category);
      return count ? previous.map(role => role.category === category ? { ...role, quantity } : role) : [...previous, { category, quantity }];
    });
  }
  async function submit() {
    setBusy(true); setError('');
    try {
      if (title.trim().length < 3 || requirements.trim().length < 20) throw new Error('Add an event title and requirements of at least 20 characters.');
      if (!roles.length) throw new Error('Add at least one profession to your team list.');
      if (!venue || !confirmed) throw new Error('Choose your event location and confirm its exact pin.');
      if (date.getTime() <= Date.now()) throw new Error('Choose a future event date and start time.');
      if(billingMode==='hourly'&&(!Number.isInteger(Number(plannedHours))||Number(plannedHours)<1||Number(plannedHours)>24))throw new Error('Choose planned coverage from 1 to 24 hours. Actual hours determine the final bill.');
      const id = await team.postTeamEvent(title, requirements, date, venue, point, roles, requestId,billingMode,billingMode==='hourly'?Number(plannedHours):8); onPosted(id);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <>
    <AppearanceSelect label="Event billing" value={billingMode} options={[{value:'hourly',label:'Wedding · hourly billing'},{value:'fixed',label:'Other event · fixed price'}]} onChange={value=>setBillingMode(value as 'fixed'|'hourly')} colors={colors}/>
    {billingMode==='hourly'&&<Card><Text style={styles.heading}>Pay for actual service hours</Text><Text style={styles.muted}>Agree each professional's hourly rate. Start and end OTPs record service time. Partial hours round up; final payment is after service. No total budget is fixed now.</Text><Field label="Planned coverage (hours)" value={plannedHours} onChange={setPlannedHours} numeric/><Text style={styles.muted}>Used to reserve availability only. The verified service time determines the invoice.</Text></Card>}
    <Field label="Event name / project title" value={title} onChange={setTitle} placeholder="Wedding, campaign or creative project" maxLength={120} />
    <Field label="Requirements" value={requirements} onChange={setRequirements} multiline maxLength={2000} placeholder="Tell your team about the event, work needed and service expectations." />
    <Card><View style={styles.between}><Text style={styles.heading}>Build your team</Text><Text style={styles.muted}>{roles.reduce((sum, role) => sum + role.quantity, 0)} selected</Text></View>
      <Text style={styles.muted}>Add the people you need. Adjust counts on each card.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
        {visibleCategories.map(category => {
          const count = roles.find(role => role.category === category)?.quantity || 0;
          return <View key={category} style={{ width: '48%', gap: 12, padding: 10, borderRadius: 16, borderWidth: count ? 2 : 1, borderColor: count ? colors.text : colors.line, backgroundColor: colors.panel }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><ServiceCraftIcon category={category} size={42} /><Text numberOfLines={2} style={{ flex: 1, color: colors.text, fontSize: 11, lineHeight: 15, fontWeight: '600' }}>{categoryLabels[category]}</Text></View>
            {count ? <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 10 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={'Decrease ' + categoryLabels[category] + ' count'} onPress={() => adjustRole(category, -1)} style={{ width: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22, color: colors.text }}>{'\u2212'}</Text></Pressable>
              <Text accessibilityLiveRegion="polite" accessibilityLabel={categoryLabels[category] + ' count ' + count} style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{count}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={'Add ' + categoryLabels[category] + ' to team'} accessibilityState={{ selected: true, disabled: count >= 20 }} disabled={count >= 20} onPress={() => adjustRole(category, 1)} style={{ width: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: count >= 20 ? .4 : 1 }}><Icon name="plus" size={16} /></Pressable>
            </View> : <Pressable accessibilityRole="button" accessibilityLabel={'Add ' + categoryLabels[category] + ' to team'} accessibilityState={{ selected: false }} onPress={() => adjustRole(category, 1)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.selected }}><Icon name="plus" size={14} /><Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Add</Text></Pressable>}
          </View>;
        })}
      </View>
    </Card>
    <Card><Text style={styles.heading}>Event location</Text>
      <LocationPicker center={point} label={venue || 'Choose an event venue'} onSelect={(value, label) => { setPoint(value); setVenue(label); setConfirmed(false); }} />
      <TalentMap center={point} height={260} centerIsLocation label="Confirm the event venue pin" onChooseLocation={value => { setPoint(value); setVenue(previous => previous || `Event pin (${value[1].toFixed(5)}, ${value[0].toFixed(5)})`); setConfirmed(true); }} />
      {Boolean(venue) && <Button title={confirmed ? 'Venue pin confirmed' : 'Confirm this venue pin'} secondary icon="pin" onPress={() => setConfirmed(true)} />}
      <Text style={styles.muted}>Search an address, use GPS or tap the map for the exact venue. The venue is visible to matching professionals.</Text>
    </Card>
    <Card><Text style={styles.heading}>Event date & start time</Text>
      <Button title={date.toLocaleDateString()} secondary icon="calendar" onPress={() => setPicker('date')} />
      <Button title={date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} secondary onPress={() => setPicker('time')} />
      {picker && <DateTimePicker mode={picker} value={date} minimumDate={new Date()} maximumDate={new Date(Date.now() + 365 * 86400000)} onChange={(_, value) => { setPicker(null); if (value) setDate(value); }} />}
    </Card>
    <Notice message={error} /><Button title="Post team request" onPress={submit} busy={busy} />
  </>;
}

function EventSummary({ event }: { event: team.TeamEvent }) {
  const { styles } = useTheme();
  return <Card><Text style={styles.heading}>{event.title}</Text><Text style={styles.muted}>{new Date(event.starts_at).toLocaleString()} · {event.venue}</Text><Text style={styles.text}>{event.requirements}</Text>
    <Text style={styles.muted}>{event.billing_mode==='hourly'?`Hourly wedding service · ${event.planned_hours||8} planned hours · pay after service`:'Fixed-price event'}</Text>
    {event.roles.map(role => <Text key={role.category} style={styles.text}>{categoryLabels[role.category]} · {role.selected || 0} / {role.quantity} selected</Text>)}
  </Card>;
}

function Applicants({ event, onBooking, onProfile, onChanged }: { event: team.TeamEvent; onBooking: CustomerProps['onBooking']; onProfile: CustomerProps['onProfile']; onChanged: () => Promise<void> }) {
  const { styles } = useTheme();
  const result = useResource(() => team.teamApplicants(event.id), event.id); useForegroundRefresh(result.refresh);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState(''); const [confirm, setConfirm] = useState<string | null>(null);
  async function act(applicant: team.TeamApplicant, action: 'accept' | 'booking' | 'profile') {
    setBusy(applicant.id); setError('');
    try {
      if (action === 'profile') {
        const { data, error } = await supabase.from('professionals').select('*').eq('id', applicant.professional_id).single();
        if (error) throw error; onProfile(data as Professional);
      } else if (action === 'booking' && applicant.booking_id) onBooking(await team.teamBooking(applicant.booking_id));
      else { await team.acceptTeamApplicant(applicant); setConfirm(null); await result.refresh(); await onChanged(); }
    } catch (e) { setError(errorText(e)); } finally { setBusy(null); }
  }
  return <><Text style={styles.heading}>Professional applications ({result.data?.length || 0})</Text><Notice message={error || result.error} />
    {result.loading && !result.data && <ActivityIndicator />}
    {!result.loading && !result.data?.length && <Text style={styles.muted}>Matching professionals can raise a request for your event. Applications will appear here.</Text>}
    {result.data?.map(applicant => {
      const filled = (event.roles.find(role => role.category === applicant.category)?.selected || 0) >= (event.roles.find(role => role.category === applicant.category)?.quantity || 0);
      return <Card key={applicant.id}><Text style={styles.heading}>{applicant.professional_name}</Text><Text style={styles.muted}>{categoryLabels[applicant.category]} · {applicant.city}</Text>
        <Text style={styles.text}>{applicant.bio}</Text><Text style={styles.heading}>{event.billing_mode==='hourly'?'Hourly service rate':'General charge'}: {money(applicant.total_paise)}{event.billing_mode==='hourly'?' / hour':''}</Text>
        <Text style={styles.muted}>{applicant.service_name} · {applicant.duration_minutes} minutes · {event.billing_mode==='hourly'?'planned coverage; booking fee added once at completion':'includes platform fees'}</Text>
        {Boolean(applicant.message) && <Text style={styles.text}>{applicant.message}</Text>}
        <TextButton title="View work & full profile" onPress={() => { void act(applicant, 'profile'); }} disabled={busy !== null} />
        {applicant.booking_id ? <><Text style={styles.muted}>Booking {applicant.booking_status?.replace('_', ' ')}</Text><Button title="Open booking" onPress={() => { void act(applicant, 'booking'); }} busy={busy === applicant.id} disabled={busy !== null} /></> : confirm === applicant.id ? <>
          <Text style={styles.text}>Confirm {applicant.professional_name} for {event.title} at {money(applicant.total_paise)}{event.billing_mode==='hourly'?' per hour? Actual hours round up after OTP verification. A booking fee is added once. Pay after service.':'? Pay from the booking before the journey.'}</Text>
          <Button title="Confirm professional" onPress={() => { void act(applicant, 'accept'); }} busy={busy === applicant.id} disabled={busy !== null || filled} />
          <TextButton title="Keep reviewing" onPress={() => setConfirm(null)} disabled={busy !== null} />
        </> : <Button title={filled ? 'Requested headcount filled' : 'Accept professional'} disabled={filled || busy !== null || new Date(event.starts_at).getTime() <= Date.now()} onPress={() => setConfirm(applicant.id)} />}
      </Card>;
    })}
  </>;
}

export function ProfessionalTeamRequests({ userId, onBooking }: { userId: string; onBooking: (booking: Booking) => void }) {
  const { styles } = useTheme();
  const result = useResource(team.teamEvents, userId); useForegroundRefresh(result.refresh);
  const ownServices = useResource(() => services(userId), userId);
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={result.loading} onRefresh={() => { void result.refresh(); void ownServices.refresh(); }} />}>
    <Text style={styles.title}>Events need your craft.</Text><Text style={styles.muted}>Apply with one of your services. The customer reviews your work and charges before choosing their team. Applying does not reserve your availability.</Text>
    <Notice message={result.error || ownServices.error} />
    {!result.loading && !result.data?.filter(event => !event.is_owner).length && <Text style={styles.text}>Matching event requests will appear here after you publish your professional profile.</Text>}
    {result.data?.filter(event => !event.is_owner).map(event => <ProfessionalApplication key={event.id} event={event} services={ownServices.data || []} onChanged={result.refresh} onBooking={onBooking} />)}
  </ScrollView>;
}

function ProfessionalApplication({ event, services: offered, onChanged, onBooking }: { event: team.TeamEvent; services: Awaited<ReturnType<typeof services>>; onChanged: () => Promise<void>; onBooking: (booking: Booking) => void }) {
  const { styles, colors } = useTheme();
  const [selectedService, setSelectedService] = useState('');const [hourlyRate,setHourlyRate]=useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const service = offered.find(item => item.id === selectedService) || offered[0];
  async function act(action: 'apply' | 'withdraw' | 'booking') {
    setBusy(true); setError('');
    try {
      if (action === 'apply' && service){if(event.billing_mode==='hourly'&&(!Number.isInteger(Number(hourlyRate))||Number(hourlyRate)<100||Number(hourlyRate)>1000000))throw new Error('Enter your whole-rupee net hourly rate from 100 to 1000000.');await team.applyToTeam(event.id, service.id, message,event.billing_mode==='hourly'?Number(hourlyRate)*100:undefined);}
      else if (action === 'withdraw') await team.withdrawTeamApplication(event.id);
      else if (event.my_application?.booking_id) onBooking(await team.teamBooking(event.my_application.booking_id));
      await onChanged();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}><EventSummary event={event} /><Card><Notice message={error} />
    {event.my_application ? <><Text style={styles.heading}>{event.my_application.booking_id ? 'The customer selected you' : 'Your application is submitted'}</Text>
      <Text style={styles.text}>{event.my_application.service_name} · You receive {money(event.my_application.net_paise)}{event.billing_mode==='hourly'?' / hour':''}</Text>
      {event.my_application.booking_id ? <Button title="Open event booking" onPress={() => { void act('booking'); }} busy={busy} /> : <><Text style={styles.muted}>Waiting for the customer to choose their team. To change your service or charges, withdraw and apply again.</Text><Button title="Withdraw application" secondary onPress={() => { void act('withdraw'); }} busy={busy} /></>}
    </> : service ? <>
      <Text style={styles.label}>Offer your service</Text><AppearanceSelect label="Service for this event" value={service.id} options={offered.map(item => ({ value: item.id, label: item.name }))} onChange={setSelectedService} colors={colors} />
      <Text style={styles.text}>{event.billing_mode==='hourly'?`${event.planned_hours||8} planned hours reserved; enter your hourly rate below.`:`${service.duration_minutes} minutes · You receive ${money(service.amount_paise)}`}</Text>
      {event.billing_mode==='hourly'&&<><Field label="Your net hourly rate (₹)" value={hourlyRate} onChange={setHourlyRate} numeric placeholder="e.g. 1500"/><Text style={styles.muted}>Your chosen amount per billable hour, after commission. Total earnings depend on verified service time, rounded up to whole hours.</Text></>}
      <Field label="Message to the customer (optional)" value={message} onChange={setMessage} multiline maxLength={1000} placeholder="Explain how your service fits this event." />
      <Button title="Raise request for this event" onPress={() => { void act('apply'); }} busy={busy} />
    </> : <Text style={styles.muted}>Add an active service to your professional profile to apply.</Text>}
  </Card></View>;
}
