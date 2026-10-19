import { useEffect,useState } from 'react';
import { Text,View } from 'react-native';
import type { Professional } from '../domain';
import { hasLiveLocation,liveLocationAddress } from '../lib/liveLocation';
import { useTheme } from '../ui';

export function ProfessionalLocation({person}:{person:Professional}){
 const {styles}=useTheme();const [,setClock]=useState(Date.now()),[address,setAddress]=useState<{key:string;value:string|null}|null>(null);
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
 const live=hasLiveLocation(person),approximate=person.location_accuracy_meters==null||person.location_accuracy_meters>100;
 // A new area/freshness state cancels the prior lookup; text is never taken from the saved profile city.
 const key=live?`${person.id}:${person.longitude.toFixed(3)},${person.latitude.toFixed(3)}:${approximate}`:'';
 useEffect(()=>{if(!live)return;const controller=new AbortController();
  void liveLocationAddress(person.longitude,person.latitude,approximate,controller.signal).then(value=>{if(!controller.signal.aborted)setAddress({key,value});}).catch(()=>{if(!controller.signal.aborted)setAddress({key,value:null});});
  return()=>controller.abort();
 },[key]);
 if(!live)return <View style={{gap:3}}><Text style={styles.muted}>Current location unavailable</Text><Text style={styles.muted}>Registered service area: {person.city}</Text></View>;
 const current=address?.key===key?address.value:null;
 return <View style={{gap:3}}>
  <Text style={styles.muted}>{approximate?'Current area':'Current location'}: {current||`${person.latitude.toFixed(5)}, ${person.longitude.toFixed(5)}`}</Text>
  {person.distance_km!=null&&<Text style={styles.muted}>{person.distance_km.toFixed(1)} km away{person.location_accuracy_meters!=null?` · accuracy about ${Math.round(person.location_accuracy_meters)} m`:' · device accuracy unavailable'}</Text>}
  {current&&<Text style={[styles.muted,{fontSize:10}]}>Address by Mapbox</Text>}
 </View>;
}
