const check=r=>{if(r.error)throw r.error;return r.data;};
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function adminAccess(db){
 const $=id=>document.getElementById(id);let version=0,locked=false;
 function tab(current){$('current-admins').hidden=!current;$('access-list').hidden=current;$('admins-current').setAttribute('aria-pressed',String(current));$('admins-requests').setAttribute('aria-pressed',String(!current));}
 $('admins-current').onclick=()=>tab(true);$('admins-requests').onclick=()=>tab(false);
 async function refresh(){
  const v=++version;$('access-notice').textContent='Loading requests…';
  try{
   const [requests,admins]=await Promise.all([db.rpc('admin_access_requests'),db.rpc('admin_current_admins')]);const rows=check(requests).filter(r=>r.status==='pending'),members=check(admins);if(v!==version)return;
   $('requests-count').textContent=String(rows.length);$('admins-count').textContent=String(members.length);$('access-list').replaceChildren();$('current-admins').replaceChildren();
   for(const r of rows){
    const card=el('article','','access-card panel'),head=el('div','','directory-card-head'),avatar=el('span',r.email.slice(0,1).toUpperCase(),'list-avatar'),copy=el('div','','directory-person');
    copy.append(el('strong',r.email),el('p','Requested '+new Date(r.requested_at).toLocaleDateString()));head.append(avatar,copy);card.append(head,el('strong','Artist House admin'),el('p','Manage banners, review talent and view the user directory.'));
    const actions=el('div','','actions');
    for(const[approve,label]of[[false,'Reject'],[true,'Approve']]){const b=el('button',label,approve?'':'secondary');b.onclick=async()=>{
     if(locked||!window.confirm(`${label} access for ${r.email}?`))return;locked=true;document.querySelectorAll('#access-list button').forEach(button=>button.disabled=true);
     try{check(await db.rpc('review_admin_access',{p_user_id:r.user_id,p_approve:approve}));await refresh();}catch(e){$('access-notice').textContent=e.message;}finally{locked=false;document.querySelectorAll('#access-list button').forEach(button=>button.disabled=false);}
    };actions.append(b);}card.append(actions);$('access-list').append(card);
   }
   if(!rows.length)$('access-list').append(el('p','No pending access requests.','profile-empty'));
   for(const member of members){const card=el('article','','directory-card panel'),avatar=el('span',member.name.slice(0,1).toUpperCase(),'list-avatar'),copy=el('div','','directory-person');copy.append(el('strong',member.name),el('p',member.email),el('span',member.owner?'Owner · You':'Admin','review-state'));card.append(avatar,copy);$('current-admins').append(card);}
   $('access-notice').textContent='';
  }catch(e){if(v===version)$('access-notice').textContent=e.message;}
 }
 function reset(){version++;$('access-list').replaceChildren();$('current-admins').replaceChildren();$('tab-access').hidden=true;}
 $('access-refresh').onclick=()=>{if(!locked)void refresh();};
 $('request-access').onclick=async()=>{$('request-access').disabled=true;try{const state=check(await db.rpc('request_admin_access'));$('request-notice').textContent=state==='approved'?'Access is approved. Tap Check access to continue.':state==='rejected'?'This request was rejected. Contact the Artist House owner.':'Request sent. The Artist House owner will review your email.';}catch(e){$('request-notice').textContent=e.message;}finally{$('request-access').disabled=false;}};
 return{refresh,reset};
}
