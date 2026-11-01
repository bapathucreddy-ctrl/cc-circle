const $=id=>document.getElementById(id);
const check=result=>{if(result.error)throw result.error;return result.data;};
export function serviceArtwork(db,getServices,getSession){
 let rows=[],chosen=null,chosenRow=null,prepared=null,previewUrl=null,busy=false,version=0;
 const note=(text,error=false)=>{$('service-photo-notice').textContent=text;$('service-photo-notice').classList.toggle('error',error);};
 const imageUrl=key=>{const row=rows.find(item=>item.service_key===key);return row?db.storage.from('service-artwork').getPublicUrl(row.image_path).data.publicUrl:`/service-defaults/${key}.jpg`;};
 function release(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;prepared=null;$('service-photo-file').value='';}
 function render(){
  const filter=$('service-photo-category').value,list=$('service-photo-list');list.replaceChildren();
  for(const service of getServices().filter(item=>!filter||item.category===filter)){
   const button=document.createElement('button');button.className='service-photo-row';button.type='button';button.setAttribute('aria-label','Edit '+service.label+' photo');
   const image=document.createElement('img');image.src=imageUrl(service.key);image.alt='';image.loading='lazy';
   const info=document.createElement('span'),title=document.createElement('strong'),sub=document.createElement('small'),arrow=document.createElement('span');title.textContent=service.label;sub.textContent=rows.some(item=>item.service_key===service.key)?'Custom photo':'Default photo';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');info.append(title,sub);button.append(image,info,arrow);button.onclick=()=>{if(!busy)edit(service);};list.append(button);
  }
 }
 function edit(service){version++;release();chosen=service;chosenRow=rows.find(row=>row.service_key===service.key)||null;$('service-photo-title').textContent=service.label;$('service-name').value=service.label;$('service-photo-preview').src=imageUrl(service.key);$('service-photo-save').disabled=true;$('service-photo-reset').hidden=!chosenRow;$('services-panel').dataset.editing='true';note('');window.scrollTo(0,0);}
 function close(){if(busy)return false;version++;release();chosen=null;delete $('services-panel').dataset.editing;note('');return true;}
 async function refresh(){const current=version;try{const data=check(await db.from('service_artwork').select('service_key,image_path,updated_at'));const catalog=check(await db.from('service_types').select('*'));if(current!==version)return;for(const item of catalog){const existing=getServices().find(s=>s.key===item.key);if(existing)existing.label=item.label;}rows=data;render();note('');}catch(error){note('Unable to load services: '+error.message,true);}}
 $('service-photo-category').onchange=render;$('service-photo-refresh').onclick=()=>{if(!busy)void refresh();};$('service-photo-back').onclick=close;
 $('service-photo-file').onchange=async()=>{
  const current=++version,file=$('service-photo-file').files[0];if(!file)return;
  prepared=null;$('service-photo-save').disabled=true;
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10485760)throw Error('Choose a JPG, PNG or WebP up to 10 MB.');
   const bitmap=await createImageBitmap(file);
   if(bitmap.width<320||bitmap.height<320||bitmap.width>12000||bitmap.height>12000){bitmap.close();throw Error('Use a photo at least 320 × 320 px and no larger than 12000 px.');}
   const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
   const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   if(canvas.width<320||canvas.height<320)throw Error('Choose a less narrow photo. Square images work best.');
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob||blob.size>5242880)throw Error('Unable to prepare this photo. Please choose a smaller image.');
   if(current!==version)return;release();prepared={blob,width:canvas.width,height:canvas.height};previewUrl=URL.createObjectURL(blob);$('service-photo-preview').src=previewUrl;$('service-photo-save').disabled=false;note('Ready to publish · '+Math.round(blob.size/1024)+' KB');
  }catch(error){if(current===version)note(error.message,true);}
 };
 function lock(value){busy=value;for(const id of ['service-photo-save','service-photo-reset','service-photo-file','service-photo-back','service-name','service-name-save'])$(id).disabled=value;}
 $('service-name-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!chosen)return;const label=$('service-name').value.trim();if(label.length<2||label.length>80){note('Use a service name between 2 and 80 characters.',true);return;}lock(true);
  try{const data=check(await db.from('service_types').update({label}).eq('key',chosen.key).eq('label',chosen.label).select('key,label'));if(data.length!==1)throw Error('Another admin renamed this service. Go back and refresh.');chosen.label=data[0].label;$('service-name').value=chosen.label;$('service-photo-title').textContent=chosen.label;render();note('Service name saved. Updated apps refresh within 30 seconds.');}catch(error){note(error.message,true);}finally{lock(false);$('service-photo-save').disabled=!prepared;}
 };
 $('service-photo-save').onclick=async()=>{
  if(busy||!chosen||!prepared)return;lock(true);let uploaded=null,saved=false;
  try{
   note('Publishing photo…');uploaded=`${getSession().user.id}/${crypto.randomUUID()}.jpg`;
   check(await db.storage.from('service-artwork').upload(uploaded,prepared.blob,{contentType:'image/jpeg',upsert:false,cacheControl:'31536000'}));
   const previous=chosenRow,payload={service_key:chosen.key,image_path:uploaded,image_width:prepared.width,image_height:prepared.height};
   const result=previous?db.from('service_artwork').update(payload).eq('service_key',chosen.key).eq('updated_at',previous.updated_at):db.from('service_artwork').insert(payload);
   const data=check(await result.select('service_key,image_path,updated_at'));if(data.length!==1)throw Error('Another admin changed this photo. Refresh and try again.');saved=true;
   chosenRow=data[0];rows=[...rows.filter(row=>row.service_key!==chosen.key),data[0]];release();$('service-photo-preview').src=imageUrl(chosen.key);$('service-photo-reset').hidden=false;render();note('Published. Updated apps show this photo within 30 seconds.');
  }catch(error){if(uploaded&&!saved)await db.storage.from('service-artwork').remove([uploaded]);note(error.message,true);}
  finally{lock(false);$('service-photo-save').disabled=!prepared;}
 };
 $('service-photo-reset').onclick=async()=>{
  if(busy||!chosen||!window.confirm('Restore the default photo for '+chosen.label+'?'))return;lock(true);
  try{const previous=chosenRow;const removed=check(await db.from('service_artwork').delete().eq('service_key',chosen.key).eq('updated_at',previous.updated_at).select('service_key'));if(removed.length!==1)throw Error('Another admin changed this photo. Refresh and try again.');chosenRow=null;rows=rows.filter(row=>row.service_key!==chosen.key);release();$('service-photo-preview').src=imageUrl(chosen.key);$('service-photo-reset').hidden=true;render();note('Default photo restored. Updated apps refresh within 30 seconds.');}catch(error){note(error.message,true);}finally{lock(false);$('service-photo-save').disabled=!prepared;}
 };
 return{refresh,close,reset(){version++;release();rows=[];chosen=null;delete $('services-panel').dataset.editing;}};
}
