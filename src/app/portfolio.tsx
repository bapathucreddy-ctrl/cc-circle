import {Text} from '../components/Typography';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Linking,Pressable,useWindowDimensions,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {api} from '../lib/api';
import {useCircle} from '../state/CircleContext';
import {Button,ErrorText,Field,Page,Title,c,s} from '../components/UI';
import PortfolioGallery from '../components/PortfolioGallery';
import PortfolioEditor from '../components/PortfolioEditor';

export default function Portfolio(){
 const onboarding=useLocalSearchParams<{onboarding?:string}>().onboarding==='1';
 const {user,token,refresh,setUser}=useCircle();const wide=useWindowDimensions().width>=900;
 const [url,setUrl]=useState('');
 const [capabilities,setCapabilities]=useState<{youtube:boolean;instagram:boolean;behance:boolean}|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const pendingConnection=useRef<{provider:'youtube'|'instagram';checks:Record<string,string|null|undefined>}|null>(null);
 const checkConnection=useCallback(async()=>{
  if(!token)return;
  try{
   const profile=await api.me(token);setUser(profile);
   const pending=pendingConnection.current;
   if(pending){
    const connected=profile.links.find(link=>link.source_type===pending.provider&&link.last_checked_at&&link.last_checked_at!==pending.checks[link.id]);
    if(connected){pendingConnection.current=null;setNotice(`${pending.provider==='youtube'?'YouTube':'Instagram'} connected. Your imported media is now on your profile.`)}
    else setNotice('Connection has not completed. Finish authorizing in your browser, then check again or retry.');
   }else setNotice('Your profile media has been refreshed.');
  }catch(e){setError((e as Error).message)}
 },[token,setUser]);
 useEffect(()=>{api.connectionCapabilities().then(setCapabilities).catch(e=>setError((e as Error).message))},[]);
 useEffect(()=>{
  const subscription=AppState.addEventListener('change',state=>{if(state==='active'&&pendingConnection.current)void checkConnection()});
  return()=>subscription.remove();
 },[checkConnection]);
 const add=async()=>{
  if(!token)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await api.addPortfolio(token,url);
   await refresh();setUrl('');
   setNotice(result.error?`Link saved. ${result.error}`:`Found ${result.images} images and ${result.videos} videos from this page.`);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const remove=async(id:string)=>{
  if(!token)return;setBusy(true);setError('');
  try{await api.removePortfolio(token,id);await refresh();setNotice('Link and its imported media removed.')}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const rescan=async()=>{
  if(!token)return;setBusy(true);setError('');
  try{const result=await api.refreshPortfolios(token);await refresh();setNotice([`Checked ${result.results.length} public links. Your profile now shows ${result.media.filter(m=>m.kind==='image').length} images and ${result.media.filter(m=>m.kind==='video').length} videos.`,...new Set(result.results.map(item=>item.error).filter(Boolean))].join(' '))}
  catch(e){setError((e as Error).message)}finally{setBusy(false)}
 };
 const connect=async(provider:'youtube'|'instagram')=>{
  if(!token)return;setBusy(true);setError('');setNotice('');
  try{
   const result=await (provider==='youtube'?api.connectYouTube(token):api.connectInstagram(token));
   pendingConnection.current={provider,checks:Object.fromEntries((user?.links||[]).map(link=>[link.id,link.last_checked_at]))};
   setNotice('Authorize in your browser, then return here. Your connected media will refresh automatically.');
   await Linking.openURL(result.url);
  }catch(e){pendingConnection.current=null;setError((e as Error).message)}finally{setBusy(false)}
 };
 if(!user||!token)return <Page><Title eyebrow="Account" title="Sign in to add your work."/><Button title="Sign in" onPress={()=>router.push('/auth')}/></Page>;
 if(user.role!=='talent')return <Page><Title eyebrow="Talent" title="A creator account is required to add a portfolio."/><Button title="Account settings" onPress={()=>router.push('/settings')}/></Page>;
 if(onboarding)return <Page tab={false}>
  <Title eyebrow="Your work · 03 / 03" title="Bring your portfolio." subtitle="Add the public links you already use. Visitors can open your work on the original platform."/>
  {user.links.map(l=><View key={l.id} style={s.panel}><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Text numberOfLines={1} style={{color:c.ink,flex:1}}>↗ {l.url}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${l.url}`} disabled={busy} onPress={()=>remove(l.id)}><Text style={{color:c.violet}}>Remove</Text></Pressable></View></View>)}
  <Field label="Add a public profile link" value={url} onChange={setUrl} placeholder="https://behance.net/yourname"/>
  <Button title={busy?'Adding link…':'+ Add link'} outline disabled={busy||!url.trim()} onPress={add}/>
  <View style={[s.panel,{marginTop:24}]}><Text style={{color:c.muted,lineHeight:22}}>Why we ask: A working link helps teams see your work and helps us check which public profile belongs to you. No new portfolio upload is required.</Text></View>
  {notice?<Text style={{color:c.violet,marginBottom:14}}>{notice}</Text>:null}<ErrorText message={error}/>
  <Button title="Continue to verification →" disabled={busy||!user.links.length} onPress={()=>router.push({pathname:'/verify',params:{onboarding:'1'}})}/>
 </Page>;
 const images=user.media.filter(m=>m.kind==='image'&&!m.hidden).length,videos=user.media.filter(m=>m.kind==='video'&&!m.hidden).length;
 return <Page>
  <Title eyebrow="Your work" title="Let your best work lead." subtitle="Connect or paste a public profile, then choose the work and cover that hiring teams see."/>
  <Text style={s.section}>Connect an account</Text>
  <View style={{flexDirection:wide?'row':'column',gap:14}}><View style={[s.panel,{flex:1}]}><Text style={{color:c.ink,fontWeight:'900',fontSize:16}}>YouTube</Text><Text style={{color:c.muted,lineHeight:19,marginVertical:9}}>Authorize your channel to import its public videos directly from YouTube.</Text><Button title={capabilities?.youtube?(user.links.some(l=>l.source_type==='youtube')?'Reconnect YouTube':'Connect YouTube'):'YouTube connection needs app setup'} disabled={!capabilities?.youtube||busy} onPress={()=>connect('youtube')}/></View>
  <View style={[s.panel,{flex:1}]}><Text style={{color:c.ink,fontWeight:'900',fontSize:16}}>Instagram</Text><Text style={{color:c.muted,lineHeight:19,marginVertical:9}}>Connect a Creator or Business account to import its public posts. Personal accounts can be added as public links below.</Text><Button title={capabilities?.instagram?(user.links.some(l=>l.source_type==='instagram')?'Reconnect Instagram':'Connect Instagram'):'Instagram connection needs app setup'} disabled={!capabilities?.instagram||busy} onPress={()=>connect('instagram')}/></View>
  <View style={[s.panel,{flex:1}]}><Text style={{color:c.ink,fontWeight:'900',fontSize:16}}>Behance</Text><Text style={{color:c.muted,lineHeight:19,marginTop:8}}>Add your public Behance profile link below. Public work visible in its page may be discovered.</Text></View>
  </View>
  <Text style={s.section}>Add a public profile URL</Text>
  <Field label="Instagram, Behance, website or video profile" value={url} onChange={setUrl} placeholder="https://www.behance.net/yourname"/>
  <Button title={busy?'Checking public page...':'+ Add and discover media'} disabled={busy||!url.trim()} onPress={add}/>
  <Text style={{color:c.muted,fontSize:11,lineHeight:17,marginTop:12}}>Only media visible without signing in can be indexed from a pasted link. Some platforms block automated page access; the link still appears on your profile.</Text>
  <Text style={s.section}>Your linked sources</Text>
  {user.links.map(l=><View key={l.id} style={s.panel}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Pressable onPress={()=>Linking.openURL(l.url)} style={{flex:1}}><Text numberOfLines={1} style={{color:c.violet,fontWeight:'800'}}>↗ {l.url}</Text></Pressable><Pressable disabled={busy} onPress={()=>remove(l.id)}><Text style={{color:c.violet,fontWeight:'800'}}>Remove</Text></Pressable></View>
   <Text style={{color:l.last_error?'#B42318':c.muted,fontSize:11,marginTop:8}}>{l.source_type==='youtube'?'Connected YouTube channel':l.source_type==='instagram'?'Connected Instagram account':l.last_error?`Could not read media: ${l.last_error}`:l.last_checked_at?'Public page checked':'Waiting to check'}</Text>
  </View>)}
  {!user.links.length?<Text style={{color:c.muted}}>No profile links added yet.</Text>:null}
  <Text style={s.section}>Media on your profile</Text>
  <View style={[s.panel,{backgroundColor:c.soft}]}><Text style={{color:c.ink,fontWeight:'900'}}>{images} images · {videos} videos</Text><Text style={{color:c.muted,marginTop:6,fontSize:11}}>Your curated order stays consistent. Hide work you do not want on your public profile.</Text></View>
  <PortfolioGallery items={user.media}/>
  <PortfolioEditor/>
  <Button title={busy?'Refreshing...':'Refresh public links'} outline disabled={busy||!user.links.some(l=>l.source_type==='url')} onPress={rescan}/>
  <View style={{height:9}}/><Button title="Check connected media" outline disabled={busy} onPress={checkConnection}/>
  {notice?<Text style={{color:c.violet,marginTop:14,lineHeight:19}}>{notice}</Text>:null}<ErrorText message={error}/>
  <View style={{height:16}}/><Button title="View your public portfolio" onPress={()=>router.push(`/talent/${user.id}`)} disabled={!user.links.length}/>
 </Page>
}
