import {imageIdentity,isPortfolioImage} from '../../src/lib/media.ts';
import {lookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';

const maxHtmlBytes=1_500_000;
const badName=/(^localhost$|\.localhost$|\.local$|\.internal$)/i;
const imageExt=/\.(?:jpe?g|png|webp|avif|gif)$/i;
const videoExt=/\.(?:mp4|webm|mov|m4v)$/i;
const videoHost=/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com)$/i;

export function publicUrl(value,base){
 try{
  if(typeof value!=='string'||!value.trim())return null;
  const u=new URL(value.trim(),base);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.href.length>2048)return null;
  if(!u.hostname.includes('.')||badName.test(u.hostname)||isIP(u.hostname)||u.hostname.includes(':'))return null;
  u.hash='';return u.href;
 }catch{return null}
}
function publicIPv4(address){
 if(isIP(address)!==4)return false;
 const [a,b,c]=address.split('.').map(Number);
 return a>0&&a<224&&a!==10&&a!==127&&a!==169&&!(a===100&&b>=64&&b<=127)&&!(a===172&&b>=16&&b<=31)&&!(a===192&&(b===0||b===168))&&!(a===198&&(b===18||b===19||b===51&&c===100))&&!(a===203&&b===0&&c===113);
}
async function onePage(url){
 const host=new URL(url).hostname;
 const addresses=await lookup(host,{family:4,all:true});
 const address=addresses.find(x=>publicIPv4(x.address));
 if(!address)throw new Error('The portfolio host is not publicly reachable');
 return new Promise((resolve,reject)=>{
  const req=httpsRequest(url,{family:4,lookup:(hostname,options,callback)=>callback(null,address.address,4),headers:{'Accept':'text/html','Accept-Encoding':'identity','User-Agent':'CCCirclePortfolioPreview/1.0'},timeout:6000},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();resolve({redirect:res.headers.location});return}
   if(res.statusCode!==200){res.resume();reject(new Error(`Portfolio returned HTTP ${res.statusCode}`));return}
   if(!String(res.headers['content-type']||'').toLowerCase().includes('text/html')){res.resume();reject(new Error('The link is not an HTML portfolio page'));return}
   const parts=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>maxHtmlBytes){req.destroy(new Error('Portfolio page is too large'));return}parts.push(chunk)});
   res.on('end',()=>resolve({html:Buffer.concat(parts).toString('utf8')}));res.on('error',reject);
  });
  req.on('timeout',()=>req.destroy(new Error('Portfolio request timed out')));req.on('error',reject);req.end();
 });
}
export async function fetchPublicPage(submitted){
 let url=publicUrl(submitted);
 if(!url)throw new Error('A public HTTPS portfolio URL is required');
 for(let n=0;n<3;n++){
  const response=await onePage(url);
  if(response.html)return {html:response.html,url};
  url=publicUrl(response.redirect,url);
  if(!url)throw new Error('Portfolio redirected to an unsafe URL');
 }
 throw new Error('Too many portfolio redirects');
}
const decode=s=>String(s||'').replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[0-9a-f]+|\d+);/gi,token=>{
 const names={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};
 if(names[token.toLowerCase()])return names[token.toLowerCase()];
 const n=token[2].toLowerCase()==='x'?parseInt(token.slice(3,-1),16):parseInt(token.slice(2,-1),10);
 return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):token;
});
function attrs(tag){
 const out={};const body=tag.replace(/^<\/?[\w:-]+\s*/,'').replace(/\/?>(?:.|\n)*$/,'');
 for(const match of body.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))out[match[1].toLowerCase()]=decode(match[2]??match[3]??match[4]);
 return out;
}
function isVideoPage(url){
 const u=new URL(url);if(videoExt.test(u.pathname))return true;
 if(!videoHost.test(u.hostname))return false;
 if(u.hostname==='instagram.com'||u.hostname.endsWith('.instagram.com'))return ['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(?:[\w.]+\/)?(?:reel|tv)\/[\w-]+\/?$/.test(u.pathname);
 return /(?:watch|shorts|embed|live|reel|video|videos|\/\d{5,})/i.test(u.pathname);
}
function imageAccept(url){const u=new URL(url);return isPortfolioImage(url)&&!/\.(?:svg|ico)$/i.test(u.pathname)&&!/(?:avatar|favicon|sprite|placeholder|spacer|tracking|pixel)(?:[._/-]|$)/i.test(u.pathname)}
function srcset(value){return value.split(',').map(part=>{const [url,size]=part.trim().split(/\s+/);return {url,size:parseFloat(size)||0}}).filter(item=>item.url).sort((a,b)=>b.size-a.size).slice(0,1).map(item=>item.url)}

export function extractMedia(html,pageUrl){
 const images=new Map(),videos=new Map(),instagramPosts=new Set();
 const image=(raw,thumbnail=false)=>{
  const url=publicUrl(raw,pageUrl);if(url&&imageAccept(url)&&!images.has(imageIdentity(url)))images.set(imageIdentity(url),{kind:'image',url,source_url:pageUrl});return url;
 };
 const video=(raw,thumbnail)=>{
  const url=publicUrl(raw,pageUrl);if(url&&isVideoPage(url)&&!videos.has(url))videos.set(url,{kind:'video',url,thumbnail:thumbnail||null,source_url:videoExt.test(new URL(url).pathname)?pageUrl:url});
 };
 const addStructured=(node,depth=0)=>{
  if(!node||depth>8)return;
  if(Array.isArray(node)){node.slice(0,300).forEach(x=>addStructured(x,depth+1));return}
  if(typeof node!=='object')return;
  const type=String(node['@type']||'').toLowerCase();
  if(type.includes('video'))video(node.contentUrl||node.embedUrl||node.url,image(node.thumbnailUrl?.url||node.thumbnailUrl));
  if(type.includes('image'))image(node.contentUrl||node.url);
  if(node.image){if(typeof node.image==='string')image(node.image);else addStructured(node.image,depth+1)}
  if(node.thumbnailUrl&&type.includes('video'))image(typeof node.thumbnailUrl==='string'?node.thumbnailUrl:node.thumbnailUrl.url);
  for(const [key,value] of Object.entries(node).slice(0,300)){
   if(typeof value==='string'){
    if(/^(?:display_url|image_url|cover_image|thumbnail_src)$/i.test(key))image(value);
    if(/^(?:video_url|embedurl)$/i.test(key))video(value);
   }else if(value&&typeof value==='object')addStructured(value,depth+1);
  }
 };
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{addStructured(JSON.parse(match[1]))}catch{}
 }
 if(['instagram.com','www.instagram.com'].includes(new URL(pageUrl).hostname)){
  let remaining=15000;
  const readInstagram=(node,depth=0,parentSource=pageUrl)=>{
   if(!node||typeof node!=='object'||depth>24||--remaining<0)return;
   if(Array.isArray(node)){node.slice(0,300).forEach(item=>readInstagram(item,depth+1,parentSource));return}
   const code=node.code||node.shortcode;const source=typeof code==='string'&&/^[\w-]+$/.test(code)?`https://www.instagram.com/${node.media_type===2||node.is_video?'reel':'p'}/${code}/`:parentSource;
   if((node.media_type===2||node.is_video)&&source!==pageUrl)instagramPosts.add(source);
   if(Array.isArray(node.video_versions)||node.video_url){
    const playable=[...(node.video_versions||[]).map(item=>item?.url),node.video_url].map(item=>publicUrl(item)).find(url=>url&&(new URL(url).hostname.endsWith('.cdninstagram.com')||new URL(url).hostname.endsWith('.fbcdn.net')));
    if(playable&&!videos.has(playable))videos.set(playable,{kind:'video',url:playable,source_url:source,thumbnail:publicUrl(node.image_versions2?.candidates?.[0]?.url||node.display_uri)});
   }else if(node.media_type===1){
    const url=publicUrl(node.image_versions2?.candidates?.[0]?.url||node.display_uri);
    if(url&&imageAccept(url))images.set(imageIdentity(url),{kind:'image',url,source_url:source});
   }
   for(const value of Object.values(node).slice(0,300))if(value&&typeof value==='object')readInstagram(value,depth+1,source);
  };
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)){
   try{readInstagram(JSON.parse(match[1]))}catch{}
  }
 }
 let pageImage=null;
 for(const match of html.matchAll(/<(?:meta|img|source|video|a|iframe)\b[^>]*>/gi)){
  const tag=match[0],a=attrs(tag),name=tag.match(/^<([\w]+)/)?.[1]?.toLowerCase();
  if(name==='meta'){
   const prop=(a.property||a.name||'').toLowerCase();
   if(/^(?:og:image(?::url)?|twitter:image(?::src)?)$/.test(prop))pageImage=image(a.content)||pageImage;
   if(/^(?:og:video(?::url|:secure_url)?|twitter:player:stream)$/.test(prop))video(a.content,pageImage);
  }else if(name==='img'){
   const width=Number(a.width||0),height=Number(a.height||0);
   if((width&&width<160)||(height&&height<160))continue;
   for(const candidate of srcset(a.srcset||a['data-srcset']||'').length?srcset(a.srcset||a['data-srcset']||''):[a['data-src']||a.src])image(candidate);
  }else if(name==='video'){
   video(a.src,image(a.poster));
  }else if(name==='source'){
   if(a.type?.startsWith('video/')||videoExt.test(new URL(a.src||'https://invalid.example').pathname))video(a.src);
   else for(const candidate of srcset(a.srcset||''))image(candidate);
  }else if(name==='iframe'||name==='a'){
   const href=a.src||a.href;
   if(href){const resolved=publicUrl(href,pageUrl);if(resolved&&isVideoPage(resolved))video(resolved);if(resolved&&['instagram.com','www.instagram.com'].includes(new URL(pageUrl).hostname)&&['instagram.com','www.instagram.com'].includes(new URL(resolved).hostname)&&/^\/(?:[\w.]+\/)?(?:p|reel|tv)\/[\w-]+\/?$/.test(new URL(resolved).pathname))instagramPosts.add(resolved)}
   if(name==='a'&&href){const resolved=publicUrl(href,pageUrl);if(resolved&&imageExt.test(new URL(resolved).pathname))image(resolved)}
  }
 }
 return {images:[...images.values()].slice(0,80),videos:[...videos.values()].slice(0,80),instagramPosts:[...instagramPosts]};
}
export async function discoverMedia(url,{fetchPage=fetchPublicPage}={}){
 const page=await fetchPage(url);
 const pageUrl=page.url||url;
 const found=extractMedia(page.html,pageUrl);
 let warning;
 if(['instagram.com','www.instagram.com'].includes(new URL(pageUrl).hostname)){
  const current=new URL(pageUrl).pathname.match(/^\/(?:[\w.]+\/)?(?:p|reel|tv)\/([\w-]+)\/?$/)?.[1];
  const posts=current?[]:[...new Map(found.instagramPosts.map(href=>{const match=new URL(href).pathname.match(/^\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)\/?$/);return [match?.[2],match?`https://www.instagram.com/${match[1]}/${match[2]}/`:null]}).filter(([code,href])=>code&&href)).values()].slice(0,10);
  const results=await Promise.allSettled(posts.map(async href=>{
   const post=await fetchPage(href);
   return extractMedia(post.html,post.url||href);
  }));
  for(const result of results)if(result.status==='fulfilled'){found.videos.push(...result.value.videos);found.images.push(...result.value.images)}
  // A Reel page URL is not a video file. Keep only exposed CDN/file URLs.
  found.videos=found.videos.filter(item=>!['instagram.com','www.instagram.com'].includes(new URL(item.url).hostname));
  if(!found.videos.length)warning='Instagram did not expose direct video URLs on this public page. Add an individual Reel URL or connect your professional Instagram account to import videos; available images were retained.';
 }
 // Behance profiles often expose project covers; read up to five public projects too.
 if(['behance.net','www.behance.net'].includes(new URL(pageUrl).hostname)&&!new URL(pageUrl).pathname.startsWith('/gallery/')){
  const projects=new Set();
  for(const tag of page.html.matchAll(/<a\b[^>]*>/gi)){
   const href=publicUrl(attrs(tag[0]).href,pageUrl);
   if(href&&['behance.net','www.behance.net'].includes(new URL(href).hostname)&&/^\/gallery\/\d+(?:\/|$)/.test(new URL(href).pathname))projects.add(href);
   if(projects.size===5)break;
  }
  const results=await Promise.allSettled([...projects].map(async href=>{const project=await fetchPage(href);return extractMedia(project.html,project.url||href)}));
  for(const result of results)if(result.status==='fulfilled'){found.images.push(...result.value.images);found.videos.push(...result.value.videos)}
 }
 return {images:[...new Map(found.images.map(item=>[imageIdentity(item.url),item])).values()].slice(0,80),videos:[...new Map(found.videos.map(item=>[item.url,item])).values()].slice(0,80),...(warning?{warning}:{})};
}
