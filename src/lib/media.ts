export function imageIdentity(raw:string){
 try{
  const url=new URL(raw);url.hash='';
  if(/(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(url.hostname))return `instagram:${url.pathname.split('/').pop()}`;
  for(const key of ['w','h','width','height','q','quality','fit','crop','auto','format','dpr'])url.searchParams.delete(key);
  return url.href;
 }catch{return raw}
}
export function isPortfolioImage(raw:string){
 try{return !/(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/.test(new URL(raw).hostname)||!/\/t[^/]*-19\//.test(new URL(raw).pathname)}catch{return true}
}

export function portfolioMedia<T extends {kind:string;url:string;hidden?:boolean}>(items:T[],kind:string){
 const seen=new Set<string>();
 return items.filter(item=>{
  const key=kind==='image'?imageIdentity(item.url):item.url;
  if(item.kind!==kind||item.hidden||(kind==='image'&&!isPortfolioImage(item.url))||seen.has(key))return false;
  seen.add(key);
  return true;
 }).slice(0,10);
}

export function fitVideoSize(bounds:{width:number;height:number},aspectRatio=16/9){
 const ratio=Number.isFinite(aspectRatio)&&aspectRatio>0?aspectRatio:16/9;
 const width=Math.max(0,Math.min(bounds.width,bounds.height*ratio));
 return {width,height:width/ratio};
}

// Page URLs need a provider player; only media URLs go to the native video player.
export function videoSource(media:{url:string;source_url?:string|null}):{kind:'embed'|'direct';url:string}|null{
 try{
  const url=new URL(media.url);
  if(url.protocol!=='https:'||url.username||url.password)return null;
  const host=url.hostname.toLowerCase();
  if(['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host)){
   const id=host==='youtu.be'?url.pathname.split('/')[1]:url.searchParams.get('v')||url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
   return id&&/^[\w-]{11}$/.test(id)?{kind:'embed',url:`https://www.youtube.com/embed/${id}?playsinline=1`}:null;
  }
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
   const id=url.pathname.match(/\/(\d+)(?:\/|$)/)?.[1];
   return id?{kind:'embed',url:`https://player.vimeo.com/video/${id}${url.searchParams.get('h')?`?h=${encodeURIComponent(url.searchParams.get('h')!)}`:''}`}:null;
  }
  if(['instagram.com','www.instagram.com'].includes(host)){
   const post=url.pathname.match(/^\/(?:[\w.]+\/)?(?:p|reel|reels)\/([\w-]+)(?:\/|$)/);
   return post?{kind:'embed',url:`https://www.instagram.com/p/${post[1]}/embed/`}:null;
  }
  if(/\.(?:mp4|webm|mov|m4v|m3u8)$/i.test(url.pathname))return {kind:'direct',url:url.href};
  // Instagram's authorized CDN URLs may not have a file extension.
  if(media.source_url&&['instagram.com','www.instagram.com'].includes(new URL(media.source_url).hostname)&&(host.endsWith('.cdninstagram.com')||host.endsWith('.fbcdn.net')))return {kind:'direct',url:url.href};
  return null;
 }catch{return null}
}

// Keep provider player navigation in the viewer; never hand custom schemes to the OS.
export function allowVideoNavigation(request:{url:string;isTopFrame?:boolean},playerUrl:string){
 if(request.url==='about:blank')return true;
 try{
  const next=new URL(request.url),player=new URL(playerUrl);
  if(next.protocol!=='https:'||next.username||next.password)return false;
  if(request.isTopFrame===false)return true;
  return next.origin===player.origin&&next.pathname.replace(/\/$/,'')===player.pathname.replace(/\/$/,'');
 }catch{return false}
}
