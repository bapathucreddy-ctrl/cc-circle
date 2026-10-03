import React,{useEffect,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Image,Pressable,useWindowDimensions,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {categories,portraits,stills} from '../data';
import {Text} from './Typography';
import {c} from './UI';

export function buildShowcaseRows(){
 const used=new Set<number>();let nextStill=0;
 const cards=categories.map(craft=>{
  const image=used.has(craft.photo)?stills[nextStill++]:portraits[craft.photo];
  used.add(craft.photo);
  return {...craft,image};
 });
 return [0,1,2].map(()=>{
  const row=[...cards];
  for(let i=row.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[row[i],row[j]]=[row[j],row[i]]}
  return row;
 });
}

function MovingRow({row,items,compact,paused,onChoose}:{row:number;items:ReturnType<typeof buildShowcaseRows>[number];compact:boolean;paused:boolean;onChoose:(name:string)=>void}){
 const [progress]=useState(()=>new Animated.Value(0));
 const viewport=useWindowDimensions().width;
 const gap=16;
 const width=compact?Math.max(80,(Math.min(viewport-40,600)-gap*2)/3):144;
 const distance=items.length*(width+gap);
 useEffect(()=>{
  if(paused)return;
  let stopped=false;const duration=distance/18*1000;
  // Resume from the current position; reset only where the duplicated row is seamless.
  const run=()=>progress.stopAnimation(value=>{if(stopped)return;if(value>=1){progress.setValue(0);value=0}Animated.timing(progress,{toValue:1,duration:duration*(1-value),easing:Easing.linear,useNativeDriver:true,isInteraction:false}).start(({finished})=>{if(finished&&!stopped)run()})});
  run();return()=>{stopped=true;progress.stopAnimation()};
 },[progress,paused,distance]);
 const translateX=progress.interpolate({inputRange:[0,1],outputRange:row%2?[-distance,0]:[0,-distance]});
 return <View style={{height:width,overflow:'hidden',marginBottom:gap}}><Animated.View style={{flexDirection:'row',width:distance*(Math.ceil(viewport/distance)+1),transform:[{translateX}]}}>
  {Array.from({length:Math.ceil(viewport/distance)+1},(_,copy)=><View key={copy} accessibilityElementsHidden={copy>0} importantForAccessibility={copy>0?'no-hide-descendants':'auto'} style={{flexDirection:'row'}}>{items.map(craft=><Pressable key={craft.name} accessibilityRole="button" accessibilityLabel={`Explore ${craft.name}`} tabIndex={copy>0?-1:0} onPress={()=>onChoose(craft.name)} style={({pressed})=>({width,height:width,marginRight:gap,borderRadius:20,overflow:'hidden',backgroundColor:c.soft,opacity:pressed?.8:1})}><Image source={craft.image} resizeMode="cover" style={{width:'100%',height:'100%'}}/><LinearGradient pointerEvents="none" colors={['transparent','rgba(53,48,43,.65)']} style={{position:'absolute',left:0,right:0,bottom:0,height:'45%'}}/><Text numberOfLines={1} style={{position:'absolute',bottom:10,left:10,right:10,color:'white',fontSize:10,fontWeight:'600'}}>{craft.name}</Text></Pressable>)}</View>)}
 </Animated.View></View>;
}

export function CraftShowcase({onChoose,compact=false}:{onChoose:(name:string)=>void;compact?:boolean}){
 const [rows]=useState(buildShowcaseRows);
 const [paused,setPaused]=useState(false);const [hovered,setHovered]=useState(false);const [reduceMotion,setReduceMotion]=useState(true);
 useEffect(()=>{let active=true;AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduceMotion(value)}).catch(()=>{});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduceMotion);return()=>{active=false;listener.remove()}},[]);
 return <View style={{width:'100%',maxWidth:600,alignSelf:'center',marginBottom:20}}><View onPointerEnter={()=>setHovered(true)} onPointerLeave={()=>setHovered(false)} onFocus={()=>setHovered(true)} onBlur={()=>setHovered(false)} style={{overflow:'hidden',borderRadius:22,backgroundColor:c.bg}}>
  {rows.map((items,row)=><MovingRow key={row} row={row} items={items} compact={compact} paused={paused||hovered||reduceMotion} onChoose={onChoose}/>)}
  <LinearGradient pointerEvents="none" colors={['rgba(235,228,219,0)',c.bg]} style={{position:'absolute',left:0,right:0,bottom:0,height:50}}/>
 </View><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8}}><Text style={{color:c.muted,fontSize:10}}>Every craft. One creative circle.</Text>{!reduceMotion?<Pressable accessibilityRole="button" accessibilityLabel={paused?'Play moving gallery':'Pause moving gallery'} onPress={()=>setPaused(!paused)} style={{paddingHorizontal:10,minHeight:44,justifyContent:'center'}}><Text style={{color:c.violet,fontSize:11}}>{paused?'Play gallery':'Pause gallery'}</Text></Pressable>:null}</View></View>;
}
