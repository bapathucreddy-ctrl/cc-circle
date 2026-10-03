const scope='https://www.googleapis.com/auth/youtube.readonly';

export function youtubeAuthUrl({clientId,redirectUri,state}){
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope,state,access_type:'online',prompt:'consent'}).toString();
 return url.href;
}
export async function exchangeYouTubeCode({code,clientId,clientSecret,redirectUri}){
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Google did not authorize this connection');
 const data=await response.json();if(!data.access_token)throw new Error('Google returned no access token');
 return data.access_token;
}
async function getYouTube(path,token){
 const response=await fetch(`https://www.googleapis.com/youtube/v3/${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('YouTube media could not be loaded');
 return response.json();
}
export async function loadYouTubeVideos(token){
 const channels=await getYouTube('channels?part=contentDetails&mine=true',token);
 const channel=channels.items?.[0];if(!channel?.id)throw new Error('No YouTube channel found for this account');
 const playlist=channel.contentDetails?.relatedPlaylists?.uploads;
 if(!playlist)return {channelId:channel.id,videos:[]};
 const items=await getYouTube(`playlistItems?part=contentDetails&playlistId=${encodeURIComponent(playlist)}&maxResults=50`,token);
 const ids=(items.items||[]).map(x=>x.contentDetails?.videoId).filter(Boolean);
 if(!ids.length)return {channelId:channel.id,videos:[]};
 const videos=await getYouTube(`videos?part=snippet,status&id=${encodeURIComponent(ids.join(','))}&maxResults=50`,token);
 return {channelId:channel.id,videos:(videos.items||[]).filter(v=>v.status?.privacyStatus==='public').map(v=>({kind:'video',url:`https://www.youtube.com/watch?v=${v.id}`,thumbnail:v.snippet?.thumbnails?.medium?.url||v.snippet?.thumbnails?.default?.url||null})).slice(0,80)};
}
