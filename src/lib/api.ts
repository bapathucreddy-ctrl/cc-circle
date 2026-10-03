import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const API_URL=(process.env.EXPO_PUBLIC_API_URL||'http://localhost:3333').replace(/\/$/,'');
const SESSION_KEY='cc-circle-session';
export type User={id:string;name:string;city:string;category:string;bio:string;avatar:string|null;availability:string;verification:'unverified'|'pending'|'approved'|'rejected';role:'talent'|'buyer'|'admin';day_rate?:number;crafts?:string[];specialties?:string;experience?:string;rate?:string;credits?:string;available_from?:string;available_until?:string;cover?:string|null;media_count?:number};
export type Link={id:string;url:string;source_type?:'url'|'youtube'|'instagram';last_checked_at?:string|null;last_error?:string|null};
export type Media={id:string;kind:'image'|'video';url:string;thumbnail?:string|null;source_url?:string|null;hidden?:boolean;cover?:boolean;position?:number;caption?:string};
export type Talent=User&{links:Link[];media:Media[]};
export type Inquiry={id:string;buyer_id:string;talent_id:string;buyer_name:string;talent_name:string;message:string;status:'pending'|'accepted'|'declined';created_at:string;brief_id?:string|null;confirmed_at?:string|null};
export type Brief={id:string;title:string;category:string;city:string;description:string;buyer_name:string;buyer_id:string;created_at:string;crafts?:string[];budget?:string;dates?:string;deliverables?:string;deadline?:string};
export type Review={id:string;user_id:string;name:string;category:string;city:string;challenge:string;proof_url:string;consent_at:string;created_at:string;links:Link[]};
export type Verification={id:string;challenge:string;proof_url?:string;status:'draft'|'pending'|'approved'|'rejected';reason?:string};
export const avatarUrl=(v?:string|null)=>v?`${API_URL}/avatars/${v.split('/').pop()}`:null;
export async function readToken(){return Platform.OS==='web'?globalThis.sessionStorage?.getItem(SESSION_KEY)??null:SecureStore.getItemAsync(SESSION_KEY)}
export async function writeToken(value:string|null){if(Platform.OS==='web'){if(value)globalThis.sessionStorage?.setItem(SESSION_KEY,value);else globalThis.sessionStorage?.removeItem(SESSION_KEY)}else if(value)await SecureStore.setItemAsync(SESSION_KEY,value);else await SecureStore.deleteItemAsync(SESSION_KEY)}
export async function request<T>(path:string,method='GET',body?:unknown,token?:string|null):Promise<T>{
 const headers:Record<string,string>={};if(token)headers.Authorization=`Bearer ${token}`;if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),path.includes('/portfolios')?90000:30000);
 try{
  const response=await fetch(`${API_URL}${path}`,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
  const data=await response.json().catch(()=>({error:'Server returned an invalid response'}));
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
  return data as T;
 }catch(e){if(controller.signal.aborted)throw new Error('The server took too long to respond. Check your connection and try again.');throw e}finally{clearTimeout(timer)}
}
export type CommunityPost={id:string;user_id:string;body:string;created_at:string;author:Pick<User,'id'|'name'|'category'|'city'|'avatar'|'role'>;likes:number;liked:boolean;comments:{id:string;name:string;body:string;created_at:string}[]};
export const api={
 communityPosts:(token?:string|null)=>request<CommunityPost[]>(token?'/me/community/posts':'/community/posts','GET',undefined,token),
 publishPost:(token:string,body:string)=>request('/me/community/posts','POST',{body},token),
 deletePost:(token:string,id:string)=>request(`/me/community/posts/${id}`,'DELETE',undefined,token),
 likePost:(token:string,id:string,liked:boolean)=>request(`/me/community/posts/${id}/like`,'PUT',{liked},token),
 commentPost:(token:string,id:string,body:string)=>request(`/me/community/posts/${id}/comments`,'POST',{body},token),
 register:(name:string,email:string,password:string,role:'talent'|'buyer')=>request<{token:string;user:User}>('/auth/register','POST',{name,email,password,role}),
 login:(email:string,password:string)=>request<{token:string;user:User}>('/auth/login','POST',{email,password}),
 me:(token:string)=>request<Talent>('/me','GET',undefined,token),
 saveMe:(token:string,body:Pick<User,'name'|'city'|'category'|'bio'|'availability'|'role'>&Partial<User>)=>request<Talent>('/me','PUT',body,token),
 logout:(token:string)=>request('/auth/logout','POST',{},token),
 talents:(filters:Record<string,string>={})=>request<User[]>(`/talents?${new URLSearchParams(filters).toString()}`),
 talent:(id:string)=>request<Talent>(`/talents/${encodeURIComponent(id)}`),
 addPortfolio:(token:string,url:string)=>request<Link&{images:number;videos:number;error?:string}>('/me/portfolios','POST',{url},token),
 removePortfolio:(token:string,id:string)=>request(`/me/portfolios/${id}`,'DELETE',undefined,token),
 refreshPortfolios:(token:string)=>request<{results:{id:string;images:number;videos:number;error?:string}[];media:Media[]}>('/me/portfolios/refresh','POST',{},token),
 connectionCapabilities:()=>request<{youtube:boolean;instagram:boolean;behance:boolean}>('/connections/capabilities'),
 connectYouTube:(token:string)=>request<{url:string}>('/me/connect/youtube','POST',{},token),
 connectInstagram:(token:string)=>request<{url:string}>('/me/connect/instagram','POST',{},token),
 challenge:(token:string)=>request<Verification>('/me/verification/challenge','POST',{},token),
 verification:(token:string)=>request<Verification|null>('/me/verification','GET',undefined,token),
 submitVerification:(token:string,id:string,proofUrl:string,image:{uri:string;file?:File})=>{const form=new FormData();form.append('consent','true');form.append('proofUrl',proofUrl);form.append('selfie',image.file||( {uri:image.uri,name:'live-photo.jpg',type:'image/jpeg'} as unknown as Blob));return request<Verification>(`/me/verification/${id}/submit`,'POST',form,token)},
 uploadAvatar:(token:string,image:{uri:string;file?:File})=>{const form=new FormData();form.append('image',image.file||( {uri:image.uri,name:'avatar.jpg',type:'image/jpeg'} as unknown as Blob));return request<{avatar:string}>('/me/avatar','POST',form,token)},
 shortlist:(token:string)=>request<User[]>('/me/shortlist','GET',undefined,token),
 save:(token:string,id:string)=>request(`/me/shortlist/${id}`,'POST',{},token),
 unsave:(token:string,id:string)=>request(`/me/shortlist/${id}`,'DELETE',undefined,token),
 inquiries:(token:string)=>request<Inquiry[]>('/me/inquiries','GET',undefined,token),
 inquire:(token:string,talentId:string,message:string)=>request('/inquiries','POST',{talentId,message},token),
 respond:(token:string,id:string,status:'accepted'|'declined')=>request(`/me/inquiries/${id}`,'PATCH',{status},token),
 briefs:()=>request<Brief[]>('/briefs'),
 postBrief:(token:string,body:{title:string;category:string;city:string;description:string;crafts?:string[];budget?:string;dates?:string;deliverables?:string;deadline?:string})=>request('/briefs','POST',body,token),
 reviews:(token:string)=>request<Review[]>('/admin/verifications','GET',undefined,token),
 review:(token:string,id:string,decision:'approved'|'rejected',reason:string)=>request(`/admin/verifications/${id}/decision`,'POST',{decision,reason},token),
 notifications:(token:string)=>request<{id:string;body:string;created_at:string}[]>('/me/notifications','GET',undefined,token),
 mediaUpdate:(token:string,id:string,body:Partial<Media>)=>request<Talent>(`/me/media/${id}`,'PUT',body,token),
 messages:(token:string,id:string)=>request<Message[]>(`/me/inquiries/${id}/messages`,'GET',undefined,token),
 reply:(token:string,id:string,body:string)=>request(`/me/inquiries/${id}/messages`,'POST',{body},token),
 confirm:(token:string,id:string)=>request(`/me/inquiries/${id}/confirm`,'POST',{},token),
 applications:(token:string)=>request<Application[]>('/me/applications','GET',undefined,token),
 apply:(token:string,id:string,message:string)=>request<{id:string}>(`/briefs/${id}/apply`,'POST',{message},token),
 reviewApplication:(token:string,id:string,status:'accepted'|'declined')=>request(`/me/applications/${id}`,'PATCH',{status},token),
 projects:(token:string)=>request<Project[]>('/me/projects','GET',undefined,token),
 createProject:(token:string,name:string)=>request('/me/projects','POST',{name},token),
 addToProject:(token:string,id:string,talentId:string)=>request(`/me/projects/${id}/talent/${talentId}`,'POST',{},token),
 removeFromProject:(token:string,id:string,talentId:string)=>request(`/me/projects/${id}/talent/${talentId}`,'DELETE',undefined,token),
 deleteProject:(token:string,id:string)=>request(`/me/projects/${id}`,'DELETE',undefined,token),
 rotateShare:(token:string,id:string)=>request<{share_token:string}>(`/me/projects/${id}/share`,'POST',{},token),
 sharedProject:(token:string)=>request<{name:string;people:User[]}>(`/shared/projects/${encodeURIComponent(token)}`),
 following:(token:string)=>request<User[]>('/me/following','GET',undefined,token),
 follow:(token:string,id:string)=>request(`/me/following/${id}`,'POST',{},token),
 unfollow:(token:string,id:string)=>request(`/me/following/${id}`,'DELETE',undefined,token),
 searches:(token:string)=>request<SavedSearch[]>('/me/searches','GET',undefined,token),
 saveSearch:(token:string,name:string,filters:Record<string,string>)=>request('/me/searches','POST',{name,filters},token),
 deleteSearch:(token:string,id:string)=>request(`/me/searches/${id}`,'DELETE',undefined,token),
 insights:(token:string)=>request<Record<string,number>>('/me/insights','GET',undefined,token),
 deleteAccount:(token:string)=>request('/me','DELETE',undefined,token),
};

export type Message={id:string;sender_id:string;sender_name:string;body:string;created_at:string};
export type Application={id:string;brief_id:string;buyer_id:string;talent_id:string;talent_name:string;title:string;inquiry_id:string;status:Inquiry['status'];confirmed_at?:string|null};
export type Project={id:string;name:string;share_token:string;people:User[]};
export type SavedSearch={id:string;name:string;filters:Record<string,string>;matches:number};
