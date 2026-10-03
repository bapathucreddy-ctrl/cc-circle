import {Text} from './Typography';
import React,{useEffect,useState} from 'react';
import {Image,Linking,Modal,Platform,Pressable,View,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useEvent} from 'expo';
import {useVideoPlayer,VideoView} from 'expo-video';
import type {Media} from '../lib/api';
import {fitVideoSize,portfolioMedia,videoSource} from '../lib/media';
import EmbeddedVideo from './EmbeddedVideo';
import {Button,CardGrid,ErrorText,c,s} from './UI';

function MediaImage({uri}:{uri:string}){
 const [failed,setFailed]=useState(false);
 return failed?<View style={{flex:1,alignItems:'center',justifyContent:'center',padding:12}}><Text style={{color:c.muted,textAlign:'center'}}>Image unavailable. Reconnect or refresh this source.</Text></View>:<Image source={{uri}} resizeMode="contain" onError={()=>setFailed(true)} style={{width:'100%',height:'100%'}}/>;
}

function VideoFrame({aspectRatio=16/9,children}:{aspectRatio?:number;children:React.ReactNode}){
 const [bounds,setBounds]=useState({width:0,height:0});
 return <View onLayout={({nativeEvent})=>setBounds(nativeEvent.layout)} style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#000'}}><View style={fitVideoSize(bounds,aspectRatio)}>{children}</View></View>;
}

function DirectVideo({url,onError}:{url:string;onError:()=>void}){
 const player=useVideoPlayer(url);
 const {status}=useEvent(player,'statusChange',{status:player.status});
 useEffect(()=>{if(status==='error')onError()},[status,onError]);
 const sourceInfo=useEvent(player,'sourceLoad');
 const {videoTrack}=useEvent(player,'videoTrackChange',{videoTrack:player.videoTrack});
 const size=videoTrack?.size||sourceInfo?.availableVideoTracks[0]?.size||player.availableVideoTracks[0]?.size;
 const ratio=size&&size.width>0&&size.height>0?size.width/size.height:16/9;
 return <View style={{flex:1}}><VideoFrame aspectRatio={ratio}><VideoView player={player} nativeControls fullscreenOptions={{enable:true}} contentFit="contain" style={{width:'100%',height:'100%'}}/></VideoFrame>{status==='error'?<Text accessibilityRole="alert" style={{color:c.muted,padding:12}}>Video unavailable. Reconnect or refresh the source.</Text>:null}</View>;
}

function DirectVideoWeb({url,onError}:{url:string;onError:()=>void}){
 const [ratio,setRatio]=useState(16/9);
 const [failed,setFailed]=useState(false);
 return <View style={{flex:1}}><VideoFrame aspectRatio={ratio}><video src={url} controls playsInline preload="metadata" onLoadedMetadata={({currentTarget})=>{if(currentTarget.videoWidth&&currentTarget.videoHeight)setRatio(currentTarget.videoWidth/currentTarget.videoHeight)}} onError={()=>{setFailed(true);onError()}} style={{display:'block',width:'100%',height:'100%',objectFit:'contain',background:'#000'}}/></VideoFrame>{failed?<Text accessibilityRole="alert" style={{color:c.muted,padding:12}}>Video unavailable. Refresh this source.</Text>:null}</View>;
}

function VideoPreview({media}:{media:Media}){
 const [failed,setFailed]=useState(false);
 const [directFailed,setDirectFailed]=useState(false);
 const source=directFailed?(media.source_url?videoSource({url:media.source_url}):null):videoSource(media);
 if(source?.kind==='direct'&&!directFailed)return Platform.OS==='web'?<DirectVideoWeb url={source.url} onError={()=>setDirectFailed(true)}/>:<DirectVideo url={source.url} onError={()=>setDirectFailed(true)}/>;
 if(source?.kind==='embed'&&!failed)return <VideoFrame aspectRatio={source.url.includes('instagram.com')?9/16:16/9}><EmbeddedVideo url={source.url} onError={()=>setFailed(true)}/></VideoFrame>;
 return <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:20}}><Text accessibilityRole="alert" style={{color:'#EBE4DB',textAlign:'center'}}>This video could not play here. It may be private, expired, or have embedding disabled. Retry playback, or refresh the creator’s connected source.</Text></View>;
}

export default function PortfolioGallery({items}:{items:Media[]}){
 const [kind,setKind]=useState<'image'|'video'>('image');
 const [selected,setSelected]=useState<Media|null>(null);
 const [error,setError]=useState('');
 const [playbackAttempt,setPlaybackAttempt]=useState(0);
 const {width}=useWindowDimensions();
 const visible=portfolioMedia(items,kind);
 return <>
  <View style={{flexDirection:'row',marginBottom:10}}>{(['image','video'] as const).map(tab=><Pressable accessibilityRole="tab" accessibilityState={{selected:kind===tab}} key={tab} onPress={()=>setKind(tab)} style={[s.chip,{backgroundColor:kind===tab?c.violet:c.paper}]}><Text style={{color:kind===tab?'white':c.ink}}>{tab==='image'?'Images':'Videos'} · {portfolioMedia(items,tab).length}</Text></Pressable>)}</View>
  <CardGrid>{visible.map((item,index)=><Pressable accessibilityRole="button" accessibilityLabel={`${item.kind==='image'?'View image':'Play video'} ${index+1}`} key={item.id} onPress={()=>{setError('');setSelected(item)}} style={{width:width>740?'23.5%':'48%',marginBottom:14}}>
   <View style={{height:width>740?150:120,borderRadius:12,backgroundColor:c.soft,overflow:'hidden',alignItems:'center',justifyContent:'center'}}>
    {item.kind==='image'||item.thumbnail?<MediaImage key={item.kind==='image'?item.url:item.thumbnail!} uri={item.kind==='image'?item.url:item.thumbnail!}/>:null}
    {item.kind==='video'?<View style={{position:'absolute',width:40,height:40,borderRadius:20,backgroundColor:c.paper,alignItems:'center',justifyContent:'center'}}><Text style={{color:c.violet,fontSize:22}}>▶</Text></View>:null}
   </View>
   <Text numberOfLines={1} style={{color:c.muted,fontSize:11,marginTop:5}}>{item.caption||(item.kind==='image'?'View image':'Play video')}</Text>
  </Pressable>)}</CardGrid>
  {!visible.length?<Text style={{color:c.muted}}>No {kind==='image'?'images':'videos'} available yet. Connect an account or refresh its public profile link.</Text>:null}
  <Modal visible={!!selected} animationType="slide" onRequestClose={()=>setSelected(null)}>
   <SafeAreaView style={{flex:1,backgroundColor:c.bg}}>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:20,paddingVertical:8}}><Text style={{color:c.ink,fontWeight:'900',fontSize:18}}>{selected?.kind==='image'?'Portfolio image':'Portfolio video'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close media viewer" onPress={()=>setSelected(null)} style={{padding:12}}><Text style={{color:c.violet,fontWeight:'800'}}>Close</Text></Pressable></View>
    <View style={{flex:1,marginHorizontal:selected?.kind==='video'?0:20,backgroundColor:selected?.kind==='video'?'#000':c.soft}}>{selected?(selected.kind==='image'?<MediaImage key={selected.id} uri={selected.url}/>:<VideoPreview key={`${selected.id}-${playbackAttempt}`} media={selected}/>):null}</View>
    <View style={{paddingHorizontal:20,paddingVertical:12}}>{selected?.caption?<Text style={{color:c.ink,marginBottom:12}}>{selected.caption}</Text>:null}<ErrorText message={error}/>{selected?.kind==='video'?<Button title="Retry playback" outline onPress={()=>setPlaybackAttempt(attempt=>attempt+1)}/>:<Button title="Open original source ↗" outline onPress={()=>{if(selected)Linking.openURL(selected.source_url||selected.url).catch(()=>setError('Could not open this source.'))}}/>}</View>
   </SafeAreaView>
  </Modal>
 </>;
}
