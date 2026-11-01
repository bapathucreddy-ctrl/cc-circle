const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
const check=r=>{if(r.error)throw r.error;return r.data;};
const money=value=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value/100);
export function bulkRequests(db){
 const $=id=>document.getElementById(id);let version=0,locked=false,filter='pending';
 const notice=text=>{$('bulk-notice').textContent=text;};
 function reset(){version++;$('bulk-list').replaceChildren();notice('');}
 async function refresh(){if(locked)return;const v=++version;try{const events=check(await db.rpc('admin_bulk_requests'));if(v!==version)return;$('bulk-list').replaceChildren();
 for(const event of events){const card=el('article','','panel bulk-event');card.append(el('h2',event.title),el('p',new Date(event.starts_at).toLocaleString()+' · '+event.venue),el('p',event.requirements),el('p',(event.roles||[]).map(role=>role.quantity+' × '+role.category).join(' · '),'hint'));const list=el('div','','bulk-responses');
 const responses=(event.responses||[]).filter(response=>filter==='all'||response.review_status===filter);
 if(!event.responses?.length)list.append(el('p','Sent to matching professionals · awaiting responses','hint'));
 for(const response of responses){const row=el('section','','bulk-response');row.append(el('h3',response.full_name||response.first_name),el('p',response.service_name+' · '+money(response.total_paise)+(event.billing_mode==='hourly'?' / hour':'')),el('span',response.booking_id?'Confirmed · admin approved':response.review_status==='pending'?'Professional accepted · awaiting admin approval':'Admin rejected','badge'));if(response.message)row.append(el('p',response.message));
 if(response.review_status==='pending'){const note=el('textarea');note.maxLength=1000;note.rows=2;note.placeholder='Review note (optional)';note.setAttribute('aria-label','Review note for '+response.first_name);const actions=el('div','','actions');const approve=el('button','Approve & confirm'),reject=el('button','Reject','secondary');
 async function review(accepted){if(locked)return;if(accepted&&approve.dataset.confirm!=='yes'){approve.dataset.confirm='yes';approve.textContent='Confirm approval';return;}locked=true;approve.disabled=reject.disabled=true;notice('Saving review…');try{check(await db.rpc('review_bulk_response',{p_application_id:response.id,p_approve:accepted,p_note:note.value.trim(),p_expected_total_paise:response.total_paise}));notice(accepted?'Confirmed. Customer and professional notifications queued.':'Response rejected.');locked=false;await refresh();}catch(e){notice(e.message);}finally{locked=false;approve.disabled=reject.disabled=false;}}
 approve.onclick=()=>void review(true);reject.onclick=()=>void review(false);actions.append(reject,approve);row.append(note,actions);}list.append(row);}
 for(const declined of event.declines||[])if(filter==='all'||filter==='rejected')list.append(el('p',(declined.full_name||'Professional')+' · declined request','hint'));
 if(responses.length||!event.responses?.length||filter==='all'){$('bulk-list').append(card);card.append(list);}}
 if(!$('bulk-list').children.length)$('bulk-list').append(el('p','No requests in this filter.'));
 }catch(e){if(v===version)notice(e.message);}}
 $('bulk-refresh').onclick=()=>void refresh();$('bulk-filter').onchange=()=>{filter=$('bulk-filter').value;void refresh();};return{refresh,reset};
}
