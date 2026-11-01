import { useEffect, useRef } from 'react';
import { launchSplashHtml } from './launchSplashHtml';
export function LaunchSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{if(!ready)return;let finished=false;const finish=()=>{if(!finished){finished=true;onFinish();}};const message=(event:MessageEvent)=>{if(event.source===frame.current?.contentWindow&&event.data==='artist-house-splash-complete')finish();};window.addEventListener('message',message);const deadline=setTimeout(finish,6500);return()=>{clearTimeout(deadline);window.removeEventListener('message',message);};},[ready,onFinish]);
 return ready?<iframe ref={frame} title="Artist House is opening" srcDoc={launchSplashHtml} sandbox="allow-scripts" style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0,zIndex:100,background:'#ffffff'}}/>:null;
}
