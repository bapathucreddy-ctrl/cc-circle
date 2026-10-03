export function instagramAuthUrl({clientId,redirectUri,state}){
 const url=new URL('https://www.instagram.com/oauth/authorize');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'instagram_business_basic',state}).toString();
 return url.href;
}
export async function exchangeInstagramCode({code,clientId,clientSecret,redirectUri}){
 const response=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',redirect_uri:redirectUri,code}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Instagram did not authorize this connection');
 const data=await response.json();if(!data.access_token)throw new Error('Instagram returned no access token');
 return data.access_token;
}
async function graph(path,token){
 const response=await fetch(`https://graph.instagram.com/${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Instagram media could not be loaded');
 return response.json();
}
export async function loadInstagramMedia(token){
 const account=await graph('me?fields=id,username',token);
 if(!account.id||!account.username)throw new Error('No Instagram professional profile found');
 const feed=await graph('me/media?fields=id,media_type,media_url,thumbnail_url,permalink,children%7Bmedia_type,media_url,thumbnail_url%7D&limit=50',token);
 const images=[],videos=[];
 const add=(media,permalink)=>{
  if(media.media_type==='IMAGE'&&media.media_url)images.push({kind:'image',url:media.media_url,source_url:permalink});
  if(media.media_type==='VIDEO'&&media.media_url)videos.push({kind:'video',url:media.media_url,source_url:permalink,thumbnail:media.thumbnail_url||null});
 };
 for(const item of feed.data||[]){
  if(item.media_type==='CAROUSEL_ALBUM'){
   for(const child of item.children?.data||[])add(child,item.permalink);
  }else add(item,item.permalink);
 }
 return {accountId:String(account.id),username:account.username,images:images.slice(0,80),videos:[...new Map(videos.map(v=>[v.url,v])).values()].slice(0,80)};
}
