import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Icon,IconButton,useTheme} from '../ui';
import {mapLightPresets,type MapLightPreset} from '../lib/mapStyle';

export function MapHeader({label,onRecenter}:{label:string;onRecenter:()=>void}) {
 const {colors}=useTheme();
 return <View style={{paddingHorizontal:12,paddingVertical:6,flexDirection:'row',alignItems:'center',gap:12}}>
  <Text style={{flex:1,color:colors.text,fontSize:12,fontWeight:'600',lineHeight:18}}>{label}</Text>
  <IconButton name="target" label="Recenter map" onPress={onRecenter}/>
 </View>;
}

export function MapControls({aerial,onAerial,lightPreset,onLightPreset,status,distanceLabel}:{
 aerial:boolean;onAerial:(value:boolean)=>void;lightPreset:MapLightPreset;onLightPreset:(value:MapLightPreset)=>void;status?:string;distanceLabel?:string;
}) {
 const {colors}=useTheme();const [lightingOpen,setLightingOpen]=useState(false);
 const lightName=lightPreset.charAt(0).toUpperCase()+lightPreset.slice(1);
 return <View testID="map-controls" style={{padding:10,gap:10,borderTopWidth:1,borderColor:colors.line}}>
  <View style={{flexDirection:'row',gap:6}}>
   {(['3D Follow','Aerial'] as const).map(title=><Pressable key={title} accessibilityRole="button" accessibilityLabel={title==='Aerial'?'Switch to aerial view':'Switch to 3D follow view'} accessibilityState={{selected:aerial===(title==='Aerial')}} onPress={()=>onAerial(title==='Aerial')} style={{flex:1,minWidth:0,minHeight:44,paddingHorizontal:6,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:aerial===(title==='Aerial')?colors.selected:colors.panel,borderWidth:1,borderColor:aerial===(title==='Aerial')?colors.accent:colors.line}}><Text style={{fontSize:12,fontWeight:'500',color:colors.text}}>{title}</Text></Pressable>)}
   <Pressable accessibilityRole="button" accessibilityLabel="Map lighting options" accessibilityState={{expanded:lightingOpen}} onPress={()=>setLightingOpen(value=>!value)} style={{flex:1,minWidth:0,minHeight:44,paddingHorizontal:6,borderRadius:10,borderWidth:1,borderColor:colors.line,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.text,fontSize:12}}>{lightName}</Text><Icon name="chevron" color={colors.muted} size={12}/></Pressable>
  </View>
  {lightingOpen&&<View accessibilityRole="tablist" accessibilityLabel="Map lighting" style={{flexDirection:'row',gap:4,padding:4,borderRadius:12,backgroundColor:colors.input}}>
   {mapLightPresets.map(preset=><Pressable key={preset} accessibilityRole="tab" accessibilityLabel={preset+' map lighting'} aria-selected={lightPreset===preset} accessibilityState={{selected:lightPreset===preset}} onPress={()=>{onLightPreset(preset);setLightingOpen(false);}} style={{flex:1,minWidth:0,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:9,backgroundColor:lightPreset===preset?colors.action:'transparent'}}><Text style={{fontSize:11,color:lightPreset===preset?'#fff':colors.muted}}>{preset.charAt(0).toUpperCase()+preset.slice(1)}</Text></Pressable>)}
  </View>}
  {(status||distanceLabel)&&<View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:8}}>{status&&<Text style={{color:colors.muted,fontSize:12,lineHeight:18,flexShrink:1}}>{status}</Text>}{distanceLabel&&<Text style={{color:colors.text,fontSize:12,lineHeight:18}}>{distanceLabel}</Text>}</View>}
 </View>;
}
