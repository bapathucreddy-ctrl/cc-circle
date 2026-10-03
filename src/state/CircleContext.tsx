import React,{createContext,useContext,useEffect,useState} from 'react';
import {api,readToken,writeToken,Talent} from '../lib/api';
type State={token:string|null;user:Talent|null;ready:boolean;signIn:(email:string,password:string)=>Promise<void>;register:(name:string,email:string,password:string,role:'talent'|'buyer')=>Promise<void>;refresh:()=>Promise<void>;signOut:()=>Promise<void>;setUser:React.Dispatch<React.SetStateAction<Talent|null>>};
const Context=createContext<State|null>(null);
export function CircleProvider({children}:{children:React.ReactNode}){
 const [token,setToken]=useState<string|null>(null);const [user,setUser]=useState<Talent|null>(null);const [ready,setReady]=useState(false);
 useEffect(()=>{readToken().then(async t=>{if(t){try{const u=await api.me(t);setToken(t);setUser(u)}catch{await writeToken(null)}}}).finally(()=>setReady(true))},[]);
 const accept=async(t:string)=>{const u=await api.me(t);await writeToken(t);setToken(t);setUser(u)};
 const signIn=async(email:string,password:string)=>{const r=await api.login(email,password);await accept(r.token)};
 const register=async(name:string,email:string,password:string,role:'talent'|'buyer')=>{const r=await api.register(name,email,password,role);await accept(r.token)};
 const refresh=async()=>{if(token)setUser(await api.me(token))};
 const signOut=async()=>{if(token)await api.logout(token).catch(()=>{});await writeToken(null);setToken(null);setUser(null)};
 return <Context.Provider value={{token,user,ready,signIn,register,refresh,signOut,setUser}}>{children}</Context.Provider>;
}
export function useCircle(){const value=useContext(Context);if(!value)throw new Error('CircleProvider required');return value}
