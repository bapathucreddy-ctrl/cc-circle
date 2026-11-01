const launchFrame=document.getElementById('launch-splash');
function finishLaunch(){launchFrame?.remove();window.removeEventListener?.('message',onLaunchMessage);clearTimeout(launchDeadline);}
function onLaunchMessage(event){if(event.source===launchFrame?.contentWindow&&event.data==='artist-house-splash-complete')finishLaunch();}
const launchDeadline=setTimeout(finishLaunch,6500);window.addEventListener?.('message',onLaunchMessage);
import {bulkRequests} from './bulkRequests.js';
import { createClient } from '@supabase/supabase-js';
import {adminAuthStorage,nativeAuthCode} from './nativeAuth.js';
import {professionalApprovals} from './professionals.js';
import {adminAccess} from './access.js';
import {userDirectory} from './directory.js';
import {passwordControls} from './passwords.js';
import {serviceArtwork} from './serviceArtwork.js';
import {promotionControls} from './promotions.js';
const nativeAdmin = Boolean(window.CircleAndroid);
const redirectTo = nativeAdmin ? 'cccircle-admin://auth/callback' : window.location.origin;
// Keep the same key and origin across updates; Android tokens use Keystore encryption.
const bridge=window.CircleAndroid;
const persistent=nativeAdmin&&bridge.getAuthItem?{getItem:key=>bridge.getAuthItem(key),setItem:(key,value)=>bridge.setAuthItem(key,value),removeItem:key=>bridge.removeAuthItem(key)}:localStorage;
const authStorage = adminAuthStorage(sessionStorage,localStorage,persistent);
const db = createClient(__CIRCLE_SUPABASE_URL__, __CIRCLE_PUBLIC_KEY__, { auth: { storage: authStorage, storageKey: 'circle-banner-admin', persistSession:true,autoRefreshToken:true, detectSessionInUrl: !nativeAdmin, flowType: nativeAdmin ? 'pkce' : 'implicit' } });
const $ = id => document.getElementById(id);
function adminTheme(mode){document.documentElement.dataset.theme=mode;$('admin-theme').querySelector('use').setAttribute('href',mode==='dark'?'#icon-sun':'#icon-moon');$('theme-label').textContent=mode==='dark'?'Light mode':'Dark mode';$('admin-theme').setAttribute('aria-label',mode==='dark'?'Use light mode':'Use dark mode');$('account-mode').textContent=mode==='dark'?'Dark':'Light';window.CircleAndroid?.setAppearance?.(mode);}
try{adminTheme(localStorage.getItem('circle-admin-theme')==='dark'?'dark':'light');}catch{adminTheme('light');}
$('admin-theme').onclick=()=>{const mode=document.documentElement.dataset.theme==='dark'?'light':'dark';adminTheme(mode);try{localStorage.setItem('circle-admin-theme',mode);}catch{}};
const approvals = professionalApprovals(db);
const bulk=bulkRequests(db);
const access = adminAccess(db);
const directory = userDirectory(db);
const passwords = passwordControls(db,()=>authenticate(session,true));
const artwork = serviceArtwork(db,()=>services,()=>session);
const promotions = promotionControls(db);
let section='banners';
function showSection(name){section=name;for(const key of ['banners','services','approvals','bulk','users','access','account','promotions']){$(key+'-panel').hidden=key!==name;if(key!=='promotions')$('tab-'+key).setAttribute('aria-current',key===name||(key==='banners'&&name==='promotions')?'page':'false');}window.scrollTo(0,0);if(name==='bulk')void bulk.refresh();if(name==='approvals')void approvals.refresh();if(name==='access')void access.refresh();if(name==='users')void directory.refresh();if(name==='services')void artwork.refresh();if(name==='promotions')void promotions.refresh();}
for(const name of ['banners','services','approvals','bulk','users','access','account'])$('tab-'+name).onclick=()=>showSection(name);
 $('open-promotions').onclick=()=>showSection('promotions');$('promotion-back').onclick=()=>showSection('banners');
$('account-theme').onclick=()=>$('admin-theme').click();
function closeEditor(){if(busy)return false;delete $('banners-panel').dataset.editing;window.scrollTo(0,0);return true;}
$('close-editor').onclick=closeEditor;
$('close-profile').onclick=()=>{delete $('approvals-panel').dataset.detail;window.scrollTo(0,0);};
window.CircleAdminBack=()=>{if(section==='services'&&$('services-panel').dataset.editing)return artwork.close();if(section==='banners'&&$('banners-panel').dataset.editing)return closeEditor();if(section==='approvals'&&$('approvals-panel').dataset.detail){$('close-profile').click();return true;}if(section!=='banners'){showSection('banners');return true;}return false;};
let session, rows = [], services = [], selected = null, upload = null, objectUrl = null, approved = false, busy = false, pendingEmail = '', authVersion = 0, imageVersion = 0;
let bannerFilter='all';
for(const value of ['all','draft','scheduled','live'])$('banners-'+value).onclick=()=>{bannerFilter=value;for(const key of ['all','draft','scheduled','live'])$('banners-'+key).setAttribute('aria-pressed',String(key===value));render();};
const message = (id, text, error = false) => { $(id).textContent = text; $(id).classList.toggle('error', error); };
const check = result => { if (result.error) throw result.error; return result.data; };
const localDate = value => { const d = new Date(value); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
const status = row => !row.enabled ? 'Draft / paused' : new Date(row.starts_at) > Date.now() ? 'Scheduled' : new Date(row.ends_at) <= Date.now() ? 'Ended' : 'Live';
function element(tag, text, className) { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; }
function preview(path) {
  $('artwork-preview').hidden = !path; $('preview-empty').hidden = Boolean(path);
  if (path) $('artwork-preview').src = path; else $('artwork-preview').removeAttribute('src');
  const color = $('background').value; $('phone-preview').style.backgroundColor = color;
  const rgb = color.match(/\w{2}/g).map(v => parseInt(v,16)); const light = rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150;
  document.querySelector('.phone-top').style.color = light ? '#17201d' : '#fff';
  document.querySelector('.phone-top img').style.filter = light ? 'none' : 'invert(1)';
}
function serviceOptions(value = '') {
  $('service').replaceChildren(new Option('All services in this profession',''));
  services.filter(s => s.category === $('category').value).forEach(s => $('service').add(new Option(s.name || s.label || s.key,s.key)));
  $('service').value = value;
}
function featuredPicks(keys) {
  $('featured-picks').replaceChildren();
  for (const category of Array.from($('category').options)) {
    const choices=services.filter(s=>s.category===category.value); if(!choices.length)continue;
    const row=element('div','','pick-row'),label=element('label',''),checkbox=document.createElement('input'),select=document.createElement('select');
    checkbox.type='checkbox';checkbox.value=category.value;checkbox.checked=choices.some(s=>keys.includes(s.key));
    label.append(checkbox,document.createTextNode(category.text));
    for(const service of choices)select.add(new Option(service.label,service.key));
    select.value=keys.find(key=>choices.some(s=>s.key===key))||choices[0].key;
    select.setAttribute('aria-label',category.text+' featured service');select.disabled=!checkbox.checked;
    checkbox.onchange=()=>{select.disabled=!checkbox.checked;};row.append(label,select);$('featured-picks').append(row);
  }
}
function selectedPicks(){return Array.from(document.querySelectorAll('#featured-picks .pick-row')).filter(row=>row.querySelector('input').checked).map(row=>row.querySelector('select').value);}
function edit(row = null) {
  $('banners-panel').dataset.editing='true';window.scrollTo(0,0);
  imageVersion++;
  selected = row; upload = null; if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null;
  $('banner-form').reset(); $('editor-title').textContent = row ? 'Edit banner' : 'New banner';
  $('title').value = row?.title || ''; $('description').value = row?.subtitle || '';
  $('category').value = row?.category || 'Makeup'; serviceOptions(row?.service_key || '');
  featuredPicks(row?.featured_service_keys ?? (/wedding/i.test(row?.id||'') ? ['bridal-makeup','wedding-photography','bridal-hair','event-reels'] : ['festive-makeup','party-hair','event-photography','event-reels']));
  $('featured-heading').value = row?.featured_heading || 'Festive picks';
  $('starts').value = localDate(row?.starts_at || Date.now()); $('ends').value = localDate(row?.ends_at || Date.now()+7*86400000);
  $('priority').value = row?.priority ?? 200; $('background').value = row?.background_color || '#202020';
  $('image-details').textContent = row?.image_width ? `${row.image_width} × ${row.image_height}` : 'Choose finished artwork to preview.';
  preview(row?.image_path ? db.storage.from('home-banners').getPublicUrl(row.image_path).data.publicUrl : null);
  message('save-state',''); render();
}
function render() {
  $('banner-list').replaceChildren();
  for (const row of rows) {
    if(bannerFilter!=='all'&&({draft:'Draft / paused',scheduled:'Scheduled',live:'Live'})[bannerFilter]!==status(row))continue;
    const card = element('div','', 'banner-card' + (selected?.id === row.id ? ' selected' : ''));
    if(row.image_path){const img=document.createElement('img');img.src=db.storage.from('home-banners').getPublicUrl(row.image_path).data.publicUrl;img.alt=row.subtitle||row.title;img.loading='lazy';card.append(img);}
    const open = element('button',row.title,'quiet'); open.onclick = () => { if (!busy) edit(row); };
    card.append(open,element('span',status(row),'badge'),element('p',`${new Date(row.starts_at).toLocaleDateString()} – ${new Date(row.ends_at).toLocaleDateString()} · Priority ${row.priority}`));
    if (row.enabled) { const pause = element('button','Pause','quiet'); pause.onclick = async () => { if(busy)return; busy=true; try { check(await db.from('home_campaigns').update({enabled:false}).eq('id',row.id)); await refresh(); message('notice','Banner paused. Customer updates arrive within 30 seconds.'); } catch(e){message('notice',e.message,true);} finally{busy=false;} }; card.append(pause); }
    $('banner-list').append(card);
  }
  if (!rows.length) $('banner-list').append(element('p','No banners yet. Create your first campaign.'));
  $('live-count').textContent = rows.filter(r=>status(r)==='Live').length;
  $('scheduled-count').textContent = rows.filter(r=>status(r)==='Scheduled').length;
  $('draft-count').textContent = rows.filter(r=>!r.enabled).length;
}
async function refresh() {
  rows = check(await db.from('home_campaigns').select('*').order('priority',{ascending:false}).order('updated_at',{ascending:false})); render();
}
async function authenticate(next, force = false) {
  if (!force && approved && next?.user.id === session?.user.id) { session = next; return; }
  const version = ++authVersion;
  session = next; approved=false; $('workspace').hidden=true; $('denied').hidden=true; $('auth').hidden=Boolean(next);
  approvals.reset();bulk.reset();
  access.reset();
  directory.reset();
  artwork.reset();
  promotions.reset();
  delete $('banners-panel').dataset.editing;delete $('approvals-panel').dataset.detail;
  $('sign-out').hidden=!next; $('account-label').textContent=next?.user.email || '';
  $('tab-account').hidden=!next;
  $('password-setup').hidden=true;
  $('signed-in-email').textContent=next?.user.email||'';
  if (!next) return;
  try {
    const hasPassword=check(await db.rpc('my_password_setup_status'))===true;
    if(version!==authVersion)return;
    if(!hasPassword){passwords.show(next.user.email);return;}
    const allowed = check(await db.rpc('is_banner_admin')) === true;
    if (version !== authVersion) return;
    approved = allowed;
    if(!approved){$('denied').hidden=false;return;}
    const owner=check(await db.rpc('is_admin_access_owner'))===true;
    if(version!==authVersion)return;$('tab-access').hidden=!owner;
    services = check(await db.from('service_types').select('*'));
    await refresh(); if (version !== authVersion) return; edit();delete $('banners-panel').dataset.editing;showSection('banners');$('workspace').hidden=false;
  } catch(e) { $('auth').hidden=false; message('auth-notice','Unable to load banner admin: '+e.message,true); }
}
$('login-form').onsubmit=async e=>{e.preventDefault();$('send-code').disabled=true;try{
  pendingEmail=$('email').value.trim();check(await db.auth.signInWithOtp({email:pendingEmail,options:{shouldCreateUser:true,emailRedirectTo:redirectTo}}));
  $('login-form').hidden=true;$('code-form').hidden=false;message('auth-notice','Open the sign-in link in your email, or enter the code if your email contains one. New accounts must verify their email.');$('code').focus();
}catch(e){message('auth-notice',e.message,true);}finally{$('send-code').disabled=false;}};
$('code-form').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{check(await db.auth.verifyOtp({email:pendingEmail,token:$('code').value.trim(),type:'email'}));}catch(e){message('auth-notice',e.message,true);}finally{button.disabled=false;}};
$('change-email').onclick=()=>{$('login-form').hidden=false;$('code-form').hidden=true;};
$('google-sign-in').onclick=async()=>{try{const result=check(await db.auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:nativeAdmin,queryParams:{prompt:'select_account'}}}));if(nativeAdmin)window.CircleAndroid.openAuth(result.url);}catch(e){message('auth-notice',e.message,true);}};
window.CircleAdminReceiveAuth=async value=>{try{check(await db.auth.exchangeCodeForSession(nativeAuthCode(value)));}catch(e){message('auth-notice',e.message,true);}};
if(window.CircleAdminPendingAuth){const callback=window.CircleAdminPendingAuth;delete window.CircleAdminPendingAuth;void window.CircleAdminReceiveAuth(callback);}
async function signOut(){check(await db.auth.signOut({scope:'local'}));passwords.reset();message('auth-notice','');}
$('sign-out').onclick=$('switch-account').onclick=()=>signOut().catch(e=>message('auth-notice',e.message,true));
$('account-sign-out').onclick=()=>{if(window.confirm('Sign out of Artist House Admin?'))$('sign-out').click();};
$('check-access').onclick=()=>void authenticate(session);
$('account-password').onclick=()=>passwords.show(session?.user.email,false);
$('category').onchange=()=>serviceOptions();
$('background').oninput=()=>preview($('artwork-preview').getAttribute('src'));
$('new-banner').onclick=()=>{if(!busy)edit();};
$('refresh').onclick=()=>refresh().catch(e=>message('notice',e.message,true));
$('artwork').onchange=async()=>{
  const version = ++imageVersion;
  const file=$('artwork').files[0];if(!file)return;
  try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8388608)throw Error('Choose a JPG, PNG or WebP smaller than 8 MB.');
    const image=await createImageBitmap(file);const {width,height}=image;
    if(width<320||height<160||width>4096||height>4096||width/height<.5||width/height>4){image.close();throw Error('Use an image 320–4096 px wide, 160–4096 px high, with an aspect ratio between 0.5 and 4.');}
    const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,Math.floor(width*.45),0,Math.max(1,Math.floor(width*.1)),Math.max(1,Math.floor(height*.03)),0,0,1,1);
    const pixel=ctx.getImageData(0,0,1,1).data;$('background').value='#'+Array.from(pixel.slice(0,3),v=>v.toString(16).padStart(2,'0')).join('');image.close();
    if (version !== imageVersion) return;
    upload={file,width,height};if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);preview(objectUrl);$('image-details').textContent=`${width} × ${height} · ${(file.size/1048576).toFixed(1)} MB`;message('save-state','');
  }catch(e){$('artwork').value='';message('save-state',e.message,true);}
};
$('banner-form').onsubmit=async e=>{
  e.preventDefault();if(busy||!approved)return;busy=true;let uploadedPath=null, saved=false;
  document.querySelectorAll('#banner-form button, #banner-form input, #banner-form select').forEach(b=>b.disabled=true);
  try{
    const enabled=e.submitter?.value==='publish',starts=new Date($('starts').value),ends=new Date($('ends').value);
    if(!(ends>starts))throw Error('End time must be after start time.');
    if(enabled&&ends<=Date.now())throw Error('Choose an end time in the future.');
    if(enabled&&!upload&&!selected?.image_path)throw Error('Upload finished banner artwork before publishing.');
    let image_path=selected?.image_path||null,image_width=selected?.image_width||null,image_height=selected?.image_height||null;
    if(upload){message('save-state','Uploading artwork…');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[upload.file.type];
      uploadedPath=`${session.user.id}/${crypto.randomUUID()}.${ext}`;
      check(await db.storage.from('home-banners').upload(uploadedPath,upload.file,{contentType:upload.file.type,cacheControl:'31536000',upsert:false}));
      image_path=uploadedPath;image_width=upload.width;image_height=upload.height;
    }
    const payload={title:$('title').value.trim(),subtitle:$('description').value.trim(),category:$('category').value,service_key:$('service').value||null,featured_service_keys:selectedPicks(),featured_heading:$('featured-heading').value.trim()||'Festive picks',starts_at:starts.toISOString(),ends_at:ends.toISOString(),priority:Number($('priority').value),enabled,image_path,image_width,image_height,background_color:$('background').value};
    if(!payload.title)throw Error('Enter an internal campaign name.');
    const result=selected?db.from('home_campaigns').update(payload).eq('id',selected.id):db.from('home_campaigns').insert({...payload,id:crypto.randomUUID()});
    const row=check(await result.select().single());saved=true;await refresh();edit(row);message('save-state',enabled?'Published. Active banners reach the customer app within 30 seconds.':'Draft saved.');
  }catch(e){if(uploadedPath&&!saved)await db.storage.from('home-banners').remove([uploadedPath]);message('save-state',e.message,true);}
  finally{busy=false;document.querySelectorAll('#banner-form button, #banner-form input, #banner-form select').forEach(b=>b.disabled=false);document.querySelectorAll('#featured-picks .pick-row').forEach(row=>{row.querySelector('select').disabled=!row.querySelector('input').checked;});}
};
db.auth.onAuthStateChange((event,next)=>{if(event!=='TOKEN_REFRESHED')setTimeout(()=>authenticate(next),0);});
setInterval(()=>{if(approved&&!busy&&!document.hidden)refresh().catch(e=>message('notice',e.message,true));},30000);

setInterval(()=>{if(approved&&section==='bulk'&&document.visibilityState==='visible')void bulk.refresh();},30000);
