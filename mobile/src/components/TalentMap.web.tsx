import {useEffect,useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import mapboxgl,{type Map as MapInstance,type GeoJSONSource} from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {Asset} from 'expo-asset';
import {categoryLabels,type Coordinate,type Professional} from '../domain';
import {useTheme} from '../ui';
import {MapControls,MapHeader} from './MapControls';
import {destinationImage,trackingRiderImages,genericTrackingRiderImage} from './mapArtwork';
import {useTrackingPoint} from './useTrackingPoint';
import {useNavigationHeading} from './useNavigationHeading';
import {riderRotation} from '../lib/navigationHeading';
import {mapCameraInsets} from '../lib/mapSheet';
import {routePose} from '../lib/routePose';
import {navigationPresentation as nav} from '../lib/navigationPresentation';
import {standardMapStyle,standardMapConfig,mapRouteColor,type MapLightPreset} from '../lib/mapStyle';
import type {TalentMapProps} from './TalentMap.types';
const token=process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const mapLoadError='Unable to load Mapbox. Check the connection and graphics support.';
const empty:NonNullable<TalentMapProps['professionals']>=[];
export function TalentMap({center:rawCenter,professionals=empty,destination,heading:reportedHeading,tracking=false,trackingCategory,centerIsLocation=true,route,onSelect,onChooseLocation,height=300,label,status,distanceLabel,immersive=false,overlayBottom=0,overlayTop=0,cameraOverlayBottom=overlayBottom,selectedProfessionalId}:TalentMapProps){
 const pose=useMemo(()=>routePose(rawCenter,tracking?route:undefined),[rawCenter[0],rawCenter[1],route,tracking]);const center=tracking?pose.point:rawCenter;
 const {colors,mode}=useTheme();const container=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),rider=useRef<mapboxgl.Marker|null>(null);
 const callbacks=useRef({onSelect,onChooseLocation});callbacks.current={onSelect,onChooseLocation};
 const initialCenter=useRef(center);const moving=useTrackingPoint(center,tracking);
 const journeyHeading=useNavigationHeading(center,pose.heading??reportedHeading,route);const heading=tracking?journeyHeading:0;
 const cameraInsets=mapCameraInsets(height,overlayTop,cameraOverlayBottom);
 const selectedProfessional=professionals.find(person=>person.id===selectedProfessionalId);
 const discoveryKey=professionals.map(p=>p.id).sort().join('|');
 const [ready,setReady]=useState(false),[error,setError]=useState<string|null>(null),[lighting,setLighting]=useState<MapLightPreset|null>(null),[aerial,setAerial]=useState(!tracking&&Boolean(onChooseLocation)),[recenter,setRecenter]=useState(0);
 const lightPreset=lighting||(mode==='dark'?'night':'day');const light=useRef(lightPreset);light.current=lightPreset;
 useEffect(()=>{if(!container.current)return;for(const position of ['.mapboxgl-ctrl-bottom-left','.mapboxgl-ctrl-bottom-right']){const control=container.current.querySelector<HTMLElement>(position);if(control)control.style.bottom=(overlayBottom+6)+'px';}},[ready,overlayBottom]);
 useEffect(()=>{if(!token||!container.current)return;if(!mapboxgl.supported()){setError(mapLoadError);return;}
  let instance:MapInstance;try{instance=new mapboxgl.Map({container:container.current,accessToken:token,style:standardMapStyle,config:{basemap:standardMapConfig(light.current)},center:initialCenter.current,zoom:onChooseLocation?16:tracking?nav.zoom:15.5,pitch:tracking?nav.pitch:55,attributionControl:true});}catch{setError(mapLoadError);return;}
  const element=container.current;
  const containGesture=(event:Event)=>{event.preventDefault();event.stopPropagation();};
  element.addEventListener('wheel',containGesture,{passive:false});
  element.addEventListener('touchmove',containGesture,{passive:false});
  map.current=instance;instance.on('error',event=>{const status=(event.error as {status?:number}).status;setError(status===401?'Mapbox could not authorize a map request. Some map details may be unavailable.':status===403?'Mapbox access is restricted for this app. Please contact support.':mapLoadError);});instance.on('click',event=>callbacks.current.onChooseLocation?.([event.lngLat.lng,event.lngLat.lat]));
  instance.on('style.load',()=>{try{if(!instance.getSource('booking-route'))instance.addSource('booking-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});if(!instance.getLayer('booking-route-line'))instance.addLayer({id:'booking-route-line',type:'line',slot:'middle',source:'booking-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':mapRouteColor(light.current),'line-width':5}});setReady(true);setError(null);}catch{setError(mapLoadError);}});
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>instance.resize());observer?.observe(container.current);
  return()=>{element.removeEventListener('wheel',containGesture);element.removeEventListener('touchmove',containGesture);observer?.disconnect();instance.remove();map.current=null;};
 },[]);
 useEffect(()=>{if(!ready||!map.current)return;map.current.setConfig('basemap',standardMapConfig(lightPreset));if(map.current.getLayer('booking-route-line'))map.current.setPaintProperty('booking-route-line','line-color',mapRouteColor(lightPreset));},[ready,lightPreset]);
 useEffect(()=>{const instance=map.current;if(!ready||!instance)return;const source=instance.getSource('booking-route') as GeoJSONSource|undefined;source?.setData(route&&route.length>1?{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route}}:{type:'FeatureCollection',features:[]});
  if(selectedProfessional&&!tracking&&!onChooseLocation){instance.easeTo({center:[selectedProfessional.longitude,selectedProfessional.latitude],zoom:16,pitch:aerial?0:55,padding:{top:cameraInsets.top+40,bottom:cameraInsets.bottom+45,left:40,right:60},duration:500});}
  else if(aerial&&destination){const points=[...(route||[]),center,destination];instance.fitBounds([[Math.min(...points.map(p=>p[0]))-.001,Math.min(...points.map(p=>p[1]))-.001],[Math.max(...points.map(p=>p[0]))+.001,Math.max(...points.map(p=>p[1]))+.001]],{padding:{top:cameraInsets.top+55,bottom:cameraInsets.bottom+55,left:40,right:60},pitch:0,bearing:0,duration:700});}
  else if(!tracking&&!onChooseLocation&&professionals.length){const points=[center,...professionals.map((p):Coordinate=>[p.longitude,p.latitude])];instance.fitBounds([[Math.min(...points.map(p=>p[0]))-.001,Math.min(...points.map(p=>p[1]))-.001],[Math.max(...points.map(p=>p[0]))+.001,Math.max(...points.map(p=>p[1]))+.001]],{padding:{top:cameraInsets.top+60,bottom:cameraInsets.bottom+60,left:40,right:60},maxZoom:16,pitch:aerial?0:55,duration:700});}
  else instance.easeTo({center,zoom:aerial?(onChooseLocation?16:13):tracking?nav.zoom:15.5,pitch:aerial?0:tracking?nav.pitch:55,bearing:aerial?0:heading,padding:{top:cameraInsets.top+(tracking&&!aerial?nav.paddingTop:0),bottom:cameraInsets.bottom+(tracking&&!aerial?nav.paddingBottom:0),left:0,right:0},duration:700});
 },[ready,center[0],center[1],destination?.[0],destination?.[1],aerial,heading,tracking,route,recenter,discoveryKey,selectedProfessionalId,cameraOverlayBottom,overlayTop,height]);
 useEffect(()=>{if(!ready||!map.current)return;const markers:mapboxgl.Marker[]=[];
  function add(point:Coordinate,artwork:number|undefined,size:number,title:string,onClick?:()=>void){const el=document.createElement(onClick?'button':'div');el.setAttribute('aria-label',title);Object.assign(el.style,{padding:'0',background:artwork?'transparent':colors.accent,border:artwork?'none':'2px solid '+colors.panel,borderRadius:'50%',width:size+'px',height:size+'px',cursor:onClick?'pointer':'default'});if(artwork){const img=document.createElement('img');img.src=Asset.fromModule(artwork).uri;img.alt='';Object.assign(img.style,{width:size+'px',height:size+'px',objectFit:'contain',pointerEvents:'none'});el.append(img);}if(onClick)el.addEventListener('click',event=>{event.stopPropagation();onClick();});const marker=new mapboxgl.Marker({element:el,rotationAlignment:'viewport',pitchAlignment:'viewport'}).setLngLat(point).addTo(map.current!);markers.push(marker);return marker;}
  if(tracking){
   const width=aerial?nav.aerialRiderWidth:nav.riderWidth,height=aerial?nav.aerialRiderHeight:nav.riderHeight;
   const el=document.createElement('div');el.setAttribute('aria-label',trackingCategory?categoryLabels[trackingCategory]+' travelling along the route':'Professional travelling along the route');Object.assign(el.style,{width:width+'px',height:height+'px'});
   const img=document.createElement('img');img.src=Asset.fromModule(trackingCategory?trackingRiderImages[trackingCategory]:genericTrackingRiderImage).uri;img.alt='';Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain',pointerEvents:'none'});el.append(img);
   if(aerial){const pointer=document.createElement('span');pointer.dataset.direction='true';Object.assign(pointer.style,{position:'absolute',bottom:'0',left:'50%',width:'0',height:'0',borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderBottom:'12px solid '+colors.text});el.append(pointer);}
   rider.current=new mapboxgl.Marker({element:el,anchor:'bottom',rotationAlignment:'viewport',pitchAlignment:'viewport',offset:[0,aerial?nav.aerialRiderOffset:nav.riderOffset]}).setLngLat(center).addTo(map.current);markers.push(rider.current);
  }else rider.current=add(center,centerIsLocation?destinationImage:undefined,centerIsLocation?58:18,'Current service location');
  if(destination)add(destination,destinationImage,58,'Service destination');

  return()=>{markers.forEach(m=>m.remove());rider.current=null;};
 },[ready,destination?.[0],destination?.[1],tracking,trackingCategory,centerIsLocation,colors.accent,colors.panel,colors.text,aerial]);
 useEffect(()=>{const instance=map.current;if(!instance||!tracking)return;const rotate=()=>{const pointer=rider.current?.getElement().querySelector<HTMLElement>('[data-direction]');if(pointer)pointer.style.transform='translateX(-50%) rotate('+riderRotation(heading,instance.getBearing())+'deg)';};rotate();instance.on('rotate',rotate);return()=>{instance.off('rotate',rotate);};},[heading,ready,tracking,trackingCategory,centerIsLocation,colors.accent,colors.panel,colors.text,aerial]);
 useEffect(()=>{const instance=map.current;if(!ready||!instance)return;if(tracking&&!aerial){instance.dragRotate.disable();instance.touchZoomRotate.disableRotation();}else{instance.dragRotate.enable();instance.touchZoomRotate.enableRotation();}},[ready,tracking,aerial]);
 useEffect(()=>{rider.current?.setLngLat(moving);},[moving[0],moving[1],ready,tracking,trackingCategory,centerIsLocation,colors.accent,colors.panel,aerial]);
 if(!token)return <View style={{height,padding:24,justifyContent:'center',backgroundColor:colors.input,borderRadius:16}}><Text style={{color:colors.muted,textAlign:'center'}}>Maps will be available once Mapbox is connected.</Text></View>;
 return <View style={{flex:immersive?1:undefined,height:immersive?height:undefined,borderRadius:immersive?0:20,overflow:'hidden',backgroundColor:colors.panel}}>
  {!immersive&&<MapHeader label={label||(tracking?'Journey - 3D navigation':'Explore nearby talent')} onRecenter={()=>setRecenter(v=>v+1)}/>}
  <View testID="map-viewport" style={{height:immersive?height:Math.max(height,300),position:'relative',overflow:'hidden',backgroundColor:colors.input}}>
  <div ref={container} style={{position:'absolute',inset:0,touchAction:'none',overscrollBehavior:'contain'}} aria-label="Creative talent Mapbox map"/>
  </View>
  {ready&&map.current&&professionals.map(person=><ProfessionalPin key={person.id} map={map.current!} person={person} selected={person.id===selectedProfessionalId} onSelect={onSelect}/>)}
  <View pointerEvents="box-none" style={{display:immersive&&height-overlayTop-overlayBottom<110?'none':'flex',position:'absolute',right:10,top:immersive?overlayTop+18:64,bottom:immersive?overlayBottom+30:30,justifyContent:'flex-start'}}><MapControls compact={immersive&&height-overlayTop-overlayBottom<220} onRecenter={()=>setRecenter(v=>v+1)} aerial={aerial} onAerial={setAerial} lightPreset={lightPreset} onLightPreset={setLighting} status={status} distanceLabel={distanceLabel}/></View>
  {(error||onChooseLocation)&&<Text pointerEvents="none" style={{position:'absolute',left:12,right:70,top:immersive?overlayTop+12:58,padding:8,borderRadius:10,backgroundColor:colors.panel,color:colors.muted,fontSize:11,lineHeight:17}}>{error||'Click the map to set your service location'}</Text>}
 </View>;
}

function ProfessionalPin({map,person,onSelect,selected=false}:{map:MapInstance;person:Professional;selected?:boolean;onSelect:TalentMapProps['onSelect']}){
 const point=useTrackingPoint([person.longitude,person.latitude],true);
 const marker=useRef<mapboxgl.Marker|null>(null),current=useRef({person,onSelect});current.current={person,onSelect};
 useEffect(()=>{
  const el=document.createElement('button');el.setAttribute('aria-label','View '+person.display_name+', '+categoryLabels[person.category]);
  Object.assign(el.style,{padding:'0',background:'transparent',border:'none',width:'52px',height:'78px',cursor:'pointer',borderRadius:'16px',outline:selected?'3px solid #111':'none',backgroundColor:selected?'#fff':'transparent'});
  const img=document.createElement('img');img.src=Asset.fromModule(trackingRiderImages[person.category]).uri;img.alt='';Object.assign(img.style,{width:'52px',height:'78px',objectFit:'contain',pointerEvents:'none'});el.append(img);
  el.addEventListener('click',event=>{event.stopPropagation();current.current.onSelect?.(current.current.person);});
  marker.current=new mapboxgl.Marker({element:el}).setLngLat([person.longitude,person.latitude]).addTo(map);
  return()=>{marker.current?.remove();marker.current=null;};
 },[map,person.id,person.category,person.display_name,selected]);
 useEffect(()=>{marker.current?.setLngLat(point);},[point[0],point[1]]);
 return null;
}
