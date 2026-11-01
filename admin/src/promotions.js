const $=id=>document.getElementById(id);
export function promotionControls(db){
 let revision=null,busy=false,version=0;
 const note=(text,error=false)=>{$('promotion-notice').textContent=text;$('promotion-notice').classList.toggle('error',error);};
 function fill(data){revision=data.updated_at;$('promotion-enabled').checked=data.enabled;$('promotion-count').value=String(data.daily_count);for(let i=1;i<=5;i++)$('promotion-'+i).value=data.messages.find(message=>message.slot===i)?.body||'';}
 async function refresh(){const current=++version;try{note('Loading…');const result=await db.rpc('admin_promotion_settings');if(result.error)throw result.error;if(current!==version)return;fill(result.data);note(result.data.enabled?'Daily promotions are enabled.':'Daily promotions are paused.');}catch(error){if(current===version)note(error.message,true);}}
 $('promotion-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!revision)return;const messages=Array.from({length:5},(_,i)=>$('promotion-'+(i+1)).value.trim());
  if(messages.some(message=>!message||message.length>160)||new Set(messages.map(message=>message.toLowerCase())).size!==5){note('Enter five different messages, up to 160 characters each.',true);return;}
  busy=true;$('promotion-save').disabled=true;const current=version;
  try{note('Saving…');const result=await db.rpc('save_promotion_settings',{p_messages:messages,p_enabled:$('promotion-enabled').checked,p_daily_count:Number($('promotion-count').value),p_expected_at:revision});if(result.error)throw result.error;if(current!==version)return;fill(result.data);note(result.data.enabled?'Saved. Scheduled sends use these five messages for opted-in customers.':'Saved. Daily promotions are paused.');}catch(error){if(current===version)note(error.message,true);}finally{busy=false;$('promotion-save').disabled=false;}
 };
 $('promotion-refresh').onclick=()=>{if(!busy)void refresh();};
 return{refresh,reset(){version++;revision=null;}};
}
