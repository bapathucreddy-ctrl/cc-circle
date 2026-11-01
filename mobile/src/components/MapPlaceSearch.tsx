import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Keyboard,Pressable,Text,View} from 'react-native';
import type {Coordinate} from '../domain';
import {errorText} from '../domain';
import {searchLocations,resolveLocation,type LocationResult} from '../lib/locationSearch';
import {createRequestId} from '../lib/requestId';
import {Field,Notice,useTheme} from '../ui';
/** Search only in location-selection maps, never in journey/navigation maps. */
export function MapPlaceSearch({center,onSelect}:{center:Coordinate;onSelect:(point:Coordinate,address:string)=>void}){
 const {styles,colors}=useTheme();const [query,setQuery]=useState('');const [rows,setRows]=useState<LocationResult[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const token=useRef(createRequestId());const generation=useRef(0);const selected=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;selected.current?.abort();},[]);
 useEffect(()=>{setRows([]);setError('');if(query.trim().length<3){setBusy(false);return;}const controller=new AbortController();setBusy(true);
 const timer=setTimeout(()=>{void searchLocations(query,center,token.current,controller.signal).then(result=>{if(!controller.signal.aborted)setRows(result);}).catch(e=>{if(!controller.signal.aborted)setError(errorText(e));}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});},400);
 return()=>{clearTimeout(timer);controller.abort();};},[query,center[0],center[1]]);
 async function choose(row:LocationResult){const version=++generation.current;selected.current?.abort();const controller=new AbortController();selected.current=controller;setBusy(true);setError('');try{const point=await resolveLocation(row,token.current,controller.signal);if(version!==generation.current)return;Keyboard.dismiss();setQuery('');setRows([]);onSelect(point,row.address);token.current=createRequestId();}catch(e){if(version===generation.current&&!controller.signal.aborted)setError(errorText(e));}finally{if(version===generation.current)setBusy(false);}}
 return <View style={{backgroundColor:colors.panel,borderRadius:16,padding:12,gap:6,borderWidth:1,borderColor:colors.line}}><Field label="Search on map" value={query} onChange={value=>{generation.current++;selected.current?.abort();setQuery(value);}} placeholder="Address, area or landmark" maxLength={256}/>{busy&&<ActivityIndicator accessibilityLabel="Finding places"/>}<Notice message={error}/>{rows.slice(0,4).map(row=><Pressable key={row.id} accessibilityRole="button" onPress={()=>{void choose(row);}} style={{paddingVertical:9,borderBottomWidth:1,borderColor:colors.line}}><Text style={styles.text}>{row.name}</Text><Text numberOfLines={2} style={styles.muted}>{row.address}</Text></Pressable>)}{!!rows.length&&<Text style={[styles.muted,{fontSize:10}]}>Google Maps · select a place, then adjust the pin</Text>}</View>;
}
