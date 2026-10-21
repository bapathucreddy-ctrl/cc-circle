import {useEffect,useMemo,useRef,useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import Mapbox from '@rnmapbox/maps';
import {categoryLabels,type Coordinate,type Professional} from '../domain';
import {useTheme} from '../ui';
import {MapControls,MapHeader} from './MapControls';
import type {TalentMapProps} from './TalentMap.types';
import {destinationImage,trackingRiderImages,genericTrackingRiderImage} from './mapArtwork';
import {useTrackingPoint} from './useTrackingPoint';
import {useNavigationHeading} from './useNavigationHeading';
import {riderRotation} from '../lib/navigationHeading';
import {mapCameraInsets} from '../lib/mapSheet';
import {routePose} from '../lib/routePose';
import {navigationPresentation as nav} from '../lib/navigationPresentation';
import {standardMapStyle,standardMapConfig,mapRouteColor,type MapLightPreset} from '../lib/mapStyle';
const token=process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if(token)Mapbox.setAccessToken(token);
export function TalentMap({center:rawCenter,professionals=[],destination,heading:reportedHeading,tracking=false,trackingCategory,centerIsLocation=true,route,onSelect,onChooseLocation,height=300,label,status,distanceLabel,immersive=false,overlayBottom=0,overlayTop=0,cameraOverlayBottom=overlayBottom,selectedProfessionalId}:TalentMapProps){
 const pose=useMemo(()=>routePose(rawCenter,tracking?route:undefined),[rawCenter[0],rawCenter[1],route,tracking]);const center=tracking?pose.point:rawCenter;
 const {colors,mode}=useTheme();const camera=useRef<Mapbox.Camera>(null);const moving=useTrackingPoint(center,tracking);
 const journeyHeading=useNavigationHeading(center,pose.heading??reportedHeading,route);const heading=tracking?journeyHeading:0;
 const cameraInsets=mapCameraInsets(height,overlayTop,cameraOverlayBottom);
 const selectedProfessional=professionals.find(person=>person.id===selectedProfessionalId);
 const discoveryKey=professionals.map(p=>p.id).sort().join('|');
 const [ready,setReady]=useState(false),[error,setError]=useState(false),[lighting,setLighting]=useState<MapLightPreset|null>(null),[aerial,setAerial]=useState(!tracking&&Boolean(onChooseLocation)),[recenter,setRecenter]=useState(0);
 const lightPreset=lighting||(mode==='dark'?'night':'day');const [mapBearing,setMapBearing]=useState(0);
 useEffect(()=>{if(!ready)return;if(selectedProfessional&&!tracking&&!onChooseLocation){camera.current?.setCamera({centerCoordinate:[selectedProfessional.longitude,selectedProfessional.latitude],zoomLevel:16,pitch:aerial?0:55,heading:0,padding:{paddingTop:cameraInsets.top+40,paddingBottom:cameraInsets.bottom+45,paddingLeft:40,paddingRight:60},animationDuration:500});}
 else if(aerial&&destination){const points=[...(route||[]),center,destination];const ne:Coordinate=[Math.max(...points.map(p=>p[0]))+.001,Math.max(...points.map(p=>p[1]))+.001],sw:Coordinate=[Math.min(...points.map(p=>p[0]))-.001,Math.min(...points.map(p=>p[1]))-.001];camera.current?.setCamera({bounds:{ne,sw,paddingTop:cameraInsets.top+72,paddingBottom:cameraInsets.bottom+64,paddingLeft:35,paddingRight:35},pitch:0,heading:0,animationDuration:700});}
 else if(!tracking&&!onChooseLocation&&professionals.length){const points=[center,...professionals.map((p):Coordinate=>[p.longitude,p.latitude])];camera.current?.setCamera({bounds:{ne:[Math.max(...points.map(p=>p[0]))+.001,Math.max(...points.map(p=>p[1]))+.001],sw:[Math.min(...points.map(p=>p[0]))-.001,Math.min(...points.map(p=>p[1]))-.001],paddingTop:cameraInsets.top+60,paddingBottom:cameraInsets.bottom+60,paddingLeft:60,paddingRight:60},pitch:aerial?0:55,heading:0,animationDuration:700});}
 else camera.current?.setCamera({centerCoordinate:center,pitch:aerial?0:tracking?nav.pitch:55,heading:aerial?0:heading,padding:{paddingTop:cameraInsets.top+(tracking&&!aerial?nav.paddingTop:0),paddingBottom:cameraInsets.bottom+(tracking&&!aerial?nav.paddingBottom:0),paddingLeft:0,paddingRight:0},zoomLevel:aerial?(onChooseLocation?16:13):tracking?nav.zoom:15.5,animationDuration:700});
 },[ready,center[0],center[1],destination?.[0],destination?.[1],aerial,heading,tracking,route,recenter,discoveryKey,selectedProfessionalId,cameraOverlayBottom,overlayTop,height]);
 if(!token)return <View style={{height,padding:24,justifyContent:'center',borderRadius:16,backgroundColor:colors.input}}><Text style={{color:colors.muted,textAlign:'center'}}>Maps will be available once Mapbox is connected.</Text></View>;
 return <View style={{flex:immersive?1:undefined,height:immersive?height:undefined,borderRadius:immersive?0:20,overflow:'hidden',backgroundColor:colors.panel}}>
  {!immersive&&<MapHeader label={label||(tracking?'Journey - 3D navigation':'Explore nearby talent')} onRecenter={()=>setRecenter(v=>v+1)}/>}
  <View testID="map-viewport" style={{height:immersive?height:Math.max(height,300),position:'relative',overflow:'hidden',backgroundColor:colors.input}}>
  <Mapbox.MapView scaleBarEnabled={!immersive} style={StyleSheet.absoluteFill} requestDisallowInterceptTouchEvent gestureSettings={{pinchZoomEnabled:true,panEnabled:true,rotateEnabled:!tracking||aerial}} logoPosition={{left:8,bottom:overlayBottom+8}} attributionPosition={{right:8,bottom:overlayBottom+8}} styleURL={standardMapStyle} onCameraChanged={event=>{if(tracking&&aerial)setMapBearing(Math.round(event.properties.heading));}} onDidFinishLoadingMap={()=>{setReady(true);setError(false);}} onMapLoadingError={()=>setError(true)} onPress={event=>{if(onChooseLocation&&event.geometry.type==='Point'){const [lng,lat]=event.geometry.coordinates;if(lng!==undefined&&lat!==undefined)onChooseLocation([lng,lat]);}}}>
   <Mapbox.Camera ref={camera} defaultSettings={{centerCoordinate:center,zoomLevel:onChooseLocation?16:tracking?nav.zoom:15.5,pitch:tracking?nav.pitch:55}}/>
   <Mapbox.StyleImport id="basemap" existing config={standardMapConfig(lightPreset)}/>
   {route&&route.length>1&&<Mapbox.ShapeSource id="booking-route" shape={{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route}}}><Mapbox.LineLayer id="route-line" slot="middle" style={{lineColor:mapRouteColor(lightPreset),lineWidth:5,lineCap:'round',lineJoin:'round'}}/></Mapbox.ShapeSource>}
   <Mapbox.MarkerView id="map-center" coordinate={moving} anchor={tracking?{x:.5,y:1}:undefined} allowOverlap>
    {tracking?<View accessible accessibilityLabel={trackingCategory?categoryLabels[trackingCategory]+' travelling along the route':'Professional travelling along the route'} style={{width:aerial?nav.aerialRiderWidth:nav.riderWidth,height:aerial?nav.aerialRiderHeight:nav.riderHeight,transform:[{translateY:aerial?nav.aerialRiderOffset:nav.riderOffset}]}}>
     <Image source={trackingCategory?trackingRiderImages[trackingCategory]:genericTrackingRiderImage} style={{width:'100%',height:'100%'}} resizeMode="contain" resizeMethod="resize"/>
     {aerial&&<View testID="aerial-travel-direction" style={{position:'absolute',bottom:0,left:'50%',width:0,height:0,borderLeftWidth:6,borderRightWidth:6,borderBottomWidth:12,borderLeftColor:'transparent',borderRightColor:'transparent',borderBottomColor:colors.text,transform:[{translateX:-6},{rotate:riderRotation(heading,mapBearing)+'deg'}]}}/>}
    </View>:centerIsLocation?<Image source={destinationImage} accessibilityLabel="Current service location" style={{width:58,height:58}} resizeMode="contain"/>:<View style={{width:18,height:18,borderRadius:9,backgroundColor:colors.accent,borderWidth:2,borderColor:colors.panel}}/>}
   </Mapbox.MarkerView>
   {destination&&<Mapbox.MarkerView id="destination" coordinate={destination} allowOverlap><Image source={destinationImage} accessibilityLabel="Service destination" style={{width:58,height:58}} resizeMode="contain"/></Mapbox.MarkerView>}
   {professionals.map(person=><ProfessionalPin key={person.id} person={person} selected={person.id===selectedProfessionalId} onSelect={onSelect}/>)}
  </Mapbox.MapView>
  </View>
  <View pointerEvents="box-none" style={{display:immersive&&height-overlayTop-overlayBottom<110?'none':'flex',position:'absolute',right:10,top:immersive?overlayTop+18:64,bottom:immersive?overlayBottom+30:30,justifyContent:'flex-start'}}><MapControls compact={immersive&&height-overlayTop-overlayBottom<220} onRecenter={()=>setRecenter(v=>v+1)} aerial={aerial} onAerial={setAerial} lightPreset={lightPreset} onLightPreset={setLighting} status={status} distanceLabel={distanceLabel}/></View>
  {(error||onChooseLocation)&&<Text pointerEvents="none" style={{position:'absolute',left:12,right:70,top:immersive?overlayTop+12:58,padding:8,borderRadius:10,backgroundColor:colors.panel,color:colors.muted,fontSize:11,lineHeight:17}}>{error?'Unable to load Mapbox. Check your connection.':'Tap the map to set your service location'}</Text>}
 </View>;
}

function ProfessionalPin({person,onSelect,selected=false}:{person:Professional;selected?:boolean;onSelect:TalentMapProps['onSelect']}){
 const {colors,mode}=useTheme();const point=useTrackingPoint([person.longitude,person.latitude],true);
 return <Mapbox.MarkerView id={person.id} coordinate={point} allowOverlap><Pressable accessibilityRole="button" accessibilityLabel={'View '+person.display_name+', '+categoryLabels[person.category]} onPress={()=>onSelect?.(person)} style={{padding:4,borderRadius:16,borderWidth:selected?3:1,borderColor:selected?colors.text:colors.line,backgroundColor:mode==='dark'?'#eeeeee':colors.panel}}><Image source={trackingRiderImages[person.category]} style={{width:48,height:72}} resizeMode="contain" resizeMethod="resize"/></Pressable></Mapbox.MarkerView>;
}
