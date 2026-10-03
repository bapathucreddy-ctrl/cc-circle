import React,{useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Pressable,View} from 'react-native';
import {Button,ErrorText,Field,Page,Text,Title,c,s} from '../components/UI';
import {useCircle} from '../state/CircleContext';
import {CraftShowcase} from '../components/CraftShowcase';

export default function Auth(){
 const params=useLocalSearchParams<{mode?:string;role?:string}>();
 const {signIn,register}=useCircle();
 const [mode,setMode]=useState<'signin'|'register'>(params.mode==='register'?'register':'signin');
 const [choosingRole,setChoosingRole]=useState(false);
 const [role,setRole]=useState<'talent'|'buyer'>(params.role==='buyer'?'buyer':'talent');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const submit=async()=>{
  setBusy(true);setError('');
  try{if(mode==='signin')await signIn(email,password);else await register(name,email,password,role);router.replace(mode==='register'?{pathname:'/setup',params:{onboarding:'1'}}:'/community')}
  catch(e){setError(e instanceof Error?e.message:'Could not sign in')}
  finally{setBusy(false)}
 };
 const continueSignup=()=>{
  setError('');
  if(!name.trim()||!/^\S+@\S+\.\S+$/.test(email.trim())||password.length<10){setError('Enter your name, a valid email, and a password with at least 10 characters.');return}
  setChoosingRole(true);
 };
 return <Page tab={false}>
  {choosingRole?<>
   <Title eyebrow="Get started · 01 / 03" title="How will you use Circle?" subtitle="Choose your account type at signup: creator or hiring team."/>
   <View style={{flexDirection:'row',gap:12,marginBottom:20}}>{(['talent','buyer'] as const).map(r=><Pressable key={r} accessibilityRole="radio" accessibilityState={{checked:role===r}} onPress={()=>setRole(r)} style={[s.panel,{flex:1,borderColor:role===r?c.violet:c.line,backgroundColor:role===r?c.soft:c.paper}]}><Text style={{fontSize:27,marginBottom:12}}>{r==='talent'?'🎭':'🎬'}</Text><Text style={{color:c.ink,fontWeight:'600',fontSize:18}}>{r==='talent'?'I’m a creator':'I’m a hiring team'}</Text><Text style={{color:c.muted,marginTop:10,lineHeight:22}}>{r==='talent'?'Show your work, get discovered, find projects.':'Discover verified people and build your team.'}</Text></Pressable>)}</View>
   <View style={s.panel}><Text style={{color:c.muted,lineHeight:22}}>Keep your existing Instagram, Behance, showreel, and website links. No new portfolio upload is required.</Text></View>
   <ErrorText message={error}/><Button title={busy?'Creating account…':'Continue →'} onPress={submit} disabled={busy}/><View style={{height:10}}/><Button title="Back to account details" outline onPress={()=>setChoosingRole(false)} disabled={busy}/>
  </>:<>
   <CraftShowcase compact onChoose={category=>router.push({pathname:'/browse',params:{category}})}/>
   <View style={{alignItems:'center',marginTop:-12,marginBottom:28,paddingHorizontal:12}}>
    <View accessibilityLabel="CC Labs" style={{width:88,height:88,borderRadius:25,backgroundColor:c.violet,alignItems:'center',justifyContent:'center',marginBottom:20}}><Text style={{color:c.paper,fontSize:23,fontWeight:'600',letterSpacing:-1}}>cc labs</Text></View>
    <Text accessibilityRole="header" style={{color:c.ink,fontSize:27,lineHeight:35,fontWeight:'600',textAlign:'center',maxWidth:480}}>Your next collaboration starts here.</Text>
   </View>
   <View style={[s.panel,{width:'100%',maxWidth:560,alignSelf:'center',borderRadius:24,padding:24,marginBottom:20}]}>
   <View style={{flexDirection:'row',gap:9,marginBottom:22}}>{(['signin','register'] as const).map(m=><Pressable key={m} accessibilityRole="tab" accessibilityState={{selected:mode===m}} onPress={()=>{setMode(m);setError('')}} style={[s.chip,{backgroundColor:mode===m?c.violet:c.paper}]}><Text style={{color:mode===m?'white':c.ink}}>{m==='signin'?'Sign in':'Create account'}</Text></Pressable>)}</View>
   <Title eyebrow="Your circle" title={mode==='signin'?'Welcome back.':'Join the creative community.'} subtitle="Continue with your email and password."/>
   {mode==='register'?<Field label="Your full name" value={name} onChange={setName} placeholder="Your name"/>:null}
   <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com"/>
   <Field label="Password" value={password} onChange={setPassword} placeholder={mode==='register'?'At least 10 characters':'Your password'} secure/>
   <ErrorText message={error}/><Button title={busy?'Please wait…':mode==='register'?'Continue →':'Sign in'} onPress={mode==='register'?continueSignup:submit} disabled={busy}/>
   <Text style={{color:c.muted,fontSize:12,lineHeight:19,textAlign:'center',marginTop:20}}>Your portfolio stays on the platforms where you created it. CC Circle connects your links, role, and availability.</Text>
   </View>
   <Text style={{color:c.muted,fontSize:11,lineHeight:17,textAlign:'center',maxWidth:560,alignSelf:'center',paddingHorizontal:12}}>By joining, you consent to account data being used to operate your profile and hiring conversations. Verification photos require a separate consent step.</Text>
  </>}
 </Page>
}
