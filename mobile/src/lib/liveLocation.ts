import type { Professional } from '../domain';

export function hasLiveLocation(person: Professional, now = Date.now()) {
 const at=Date.parse(person.location_updated_at||'');
 return person.available_now&&Number.isFinite(at)&&at<=now+5000&&now-at<90000;
}

export async function liveLocationAddress(longitude:number,latitude:number,approximate:boolean,signal?:AbortSignal):Promise<string|null>{
 const token=process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
 if(!token||!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>90)return null;
 const params=new URLSearchParams({longitude:String(longitude),latitude:String(latitude),access_token:token,language:'en',limit:'1',types:approximate?'neighborhood,locality,place':'address,street,neighborhood,locality,place'});
 const response=await fetch('https://api.mapbox.com/search/geocode/v6/reverse?'+params,{signal});
 if(!response.ok)return null;
 const properties=(await response.json()).features?.[0]?.properties;
 const address=properties?.full_address||[properties?.name,properties?.place_formatted].filter(Boolean).join(', ');
 return typeof address==='string'&&address.trim()?address.trim():null;
}
