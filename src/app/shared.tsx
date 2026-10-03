import React,{useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {api,User} from '../lib/api';
import {CardGrid,ErrorText,Loading,Page,TalentCard,Title} from '../components/UI';
export default function Shared(){const {token}=useLocalSearchParams<{token:string}>();const [project,setProject]=useState<{name:string;people:User[]}|null>(null);const [error,setError]=useState('');useEffect(()=>{if(token)api.sharedProject(token).then(setProject).catch(e=>setError(e.message))},[token]);return <Page><Title eyebrow="Shared project shortlist" title={project?.name||'Your team’s shortlist'} subtitle="A read-only selection of public creator profiles. Open a portfolio to explore their work."/><ErrorText message={error||(!token?'This shortlist link is incomplete.':'')}/>{token&&!project&&!error?<Loading/>:<CardGrid>{project?.people.map(p=><TalentCard key={p.id} person={p} onPress={()=>router.push(`/talent/${p.id}`)}/>)}</CardGrid>}</Page>}
