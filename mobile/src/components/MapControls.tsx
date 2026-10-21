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

export function MapControls({aerial,onAerial,lightPreset,onLightPreset,onRecenter,status,distanceLabel,compact=false}:{
 aerial:boolean;onAerial:(value:boolean)=>void;lightPreset:MapLightPreset;onLightPreset:(value:MapLightPreset)=>void;onRecenter?:()=>void;compact?:boolean;status?:string;distanceLabel?:string;
}) {
 const {colors}=useTheme();const [optionsOpen,setOptionsOpen]=useState(false);
 const button=(selected=false)=>({width:44,minHeight:44,borderRadius:22,borderWidth:1,borderColor:selected?colors.text:colors.line,backgroundColor:colors.panel,alignItems:'center' as const,justifyContent:'center' as const,boxShadow:'0 2px 8px #00000012'});
 const option=(selected:boolean)=>({minHeight:44,flexBasis:'47%' as const,flexGrow:1,alignItems:'center' as const,justifyContent:'center' as const,borderRadius:10,backgroundColor:selected?colors.action:colors.input});
 return <View testID="map-controls" style={{width:44,alignItems:'flex-end',gap:8}}>
  <Pressable accessibilityRole="button" accessibilityLabel="Map view options" accessibilityState={{expanded:optionsOpen}} onPress={()=>setOptionsOpen(value=>!value)} style={button(optionsOpen)}><Icon name={optionsOpen?'close':'filter'} color={colors.text} size={19}/></Pressable>
  {onRecenter&&<Pressable accessibilityRole="button" accessibilityLabel="Recenter map" onPress={onRecenter} style={button()}><Icon name="target" color={colors.text} size={20}/></Pressable>}
  {optionsOpen&&<View testID="map-view-options" style={{position:'absolute',right:52,top:0,width:190,padding:10,gap:8,borderRadius:16,backgroundColor:colors.panel,borderWidth:1,borderColor:colors.line}}>
   <Text style={{fontSize:12,fontWeight:'600',color:colors.text}}>Map view</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{[{label:'3D',value:false},{label:'Aerial',value:true}].map(view=><Pressable key={view.label} accessibilityRole="button" accessibilityLabel={'Switch to '+view.label+' view'} accessibilityState={{selected:aerial===view.value}} onPress={()=>{onAerial(view.value);setOptionsOpen(false);}} style={option(aerial===view.value)}><Text style={{fontSize:12,color:aerial===view.value?'#fff':colors.text}}>{view.label}</Text></Pressable>)}</View>
   <Text style={{fontSize:12,fontWeight:'600',color:colors.text}}>Lighting</Text>
   <View accessibilityRole="tablist" accessibilityLabel="Map lighting" style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{mapLightPresets.map(preset=><Pressable key={preset} accessibilityRole="tab" accessibilityLabel={preset+' map lighting'} accessibilityState={{selected:lightPreset===preset}} onPress={()=>{onLightPreset(preset);setOptionsOpen(false);}} style={option(lightPreset===preset)}><Text style={{fontSize:11,color:lightPreset===preset?'#fff':colors.text}}>{preset.charAt(0).toUpperCase()+preset.slice(1)}</Text></Pressable>)}</View>
   {Boolean(status||distanceLabel)&&<Text style={{fontSize:10,color:colors.muted}}>{[status,distanceLabel].filter(Boolean).join(' ? ')}</Text>}
  </View>}
 </View>;
}
