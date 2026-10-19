import { useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { useForegroundRefresh, useResource } from '../hooks';
import { Button, Card, Notice, useTheme } from '../ui';
import { errorText } from '../domain';
import { professionalProfile } from '../lib/professionalProfile';
import { observeProfessionalLocation, startProfessionalLocation, stopProfessionalLocation, type LiveLocationState } from '../lib/professionalLocation';
import { coordinateLocationLabel, deviceLocationLabel } from '../lib/deviceLocation';

export function ProfessionalLiveLocation({ userId }: { userId: string }) {

 const profile=useResource(()=>professionalProfile(userId),userId,'professional-profile');
 useForegroundRefresh(profile.refresh,30000);
 const online=Boolean(profile.data?.available_now&&profile.data?.is_published);

 useEffect(()=>{
  if(profile.loading||(!profile.data&&profile.error))return;
  if(online)void startProfessionalLocation(userId).catch(()=>{});
  else void stopProfessionalLocation(userId).catch(()=>{});
  // Tracking belongs to availability, not the mounted screen or AppState.
 },[online,userId,profile.loading]);
 useEffect(()=>{
  const listener=AppState.addEventListener('change',state=>{
   if(state==='active'&&online)void startProfessionalLocation(userId).catch(()=>{});
  });return()=>listener.remove();
 },[online,userId]);
 // Keep availability tracking mounted while switching tabs. The card scrolls separately.
 return null;
}

export function ProfessionalLocationCard({ userId }: { userId: string }) {
 const { styles } = useTheme();
 const [live,setLive]=useState<LiveLocationState>({fix:null,error:'',background:false,sharing:false});
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[address,setAddress]=useState('');
 const profile=useResource(()=>professionalProfile(userId),userId,'professional-profile');
 const online=Boolean(profile.data?.available_now&&profile.data?.is_published);
 useEffect(()=>observeProfessionalLocation(setLive),[]);
 const fix=live.fix;
 useEffect(()=>{
  if(!fix)return;
  const controller=new AbortController();const point:[number,number]=[fix.coords.longitude,fix.coords.latitude];
  setAddress(coordinateLocationLabel(point,fix.coords.accuracy));
  void deviceLocationLabel(point,fix.coords.accuracy,controller.signal).then(value=>{if(!controller.signal.aborted)setAddress(value);});
  return()=>controller.abort();
 // Only resolve a new street/area after meaningful movement, not every GPS heartbeat.
 },[fix?.coords.longitude.toFixed(3),fix?.coords.latitude.toFixed(3)]);
 async function enableBackground(){
  setBusy(true);setError('');
  try{await startProfessionalLocation(userId,true);}catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 if(!profile.data?.is_published)return null;
 return <Card>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
   <Text style={[styles.heading,{fontSize:16}]}>Location</Text>
   <Text style={[styles.muted,{fontSize:12}]}>{!online?'Offline':live.sharing?'Live':'Locating...'}</Text>
  </View>
  {online&&Boolean(address)&&<Text selectable numberOfLines={2} style={[styles.text,{fontSize:13,lineHeight:18}]}>{address}</Text>}
  <Notice message={error||live.error||profile.error}/>
  {online&&((Platform.OS!=='web'&&!live.background)||Boolean(error||live.error))&&<Button title={Platform.OS==='web'||live.background?'Retry location':'Enable background location'} secondary busy={busy} onPress={()=>void enableBackground()}/>}
 </Card>;
}
