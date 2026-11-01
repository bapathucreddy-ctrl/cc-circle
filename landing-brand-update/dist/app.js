'use strict';
const services = [
  {id:'bridal-makeup',name:'Bridal makeup',group:'makeup',label:'Makeup artist',description:'A look made for your big day.',detail:'Explore bridal makeup portfolios and choose a professional whose style feels like you.',occasion:['wedding']},
  {id:'wedding-photography',name:'Wedding photography',group:'photography',label:'Photographer',description:'For the moments you’ll keep forever.',detail:'Find photographers for your wedding celebrations. Browse work samples and compare the services offered in their profiles.',occasion:['wedding']},
  {id:'party-hair',name:'Party hair styling',group:'hair',label:'Hair stylist',description:'Good hair. Great plans.',detail:'Explore hair styling for parties and celebrations, from polished updos to relaxed waves.',occasion:['party']},
  {id:'event-reels',name:'Event reel shoot',group:'content',label:'Content creator',description:'Your celebration, ready for the feed.',detail:'Find creators to capture your event as short-form content. Check each professional’s service details before booking.',occasion:['party','wedding']},
  {id:'party-makeup',name:'Party makeup',group:'makeup',label:'Makeup artist',description:'A little extra, for your next occasion.',detail:'Discover makeup artists for parties and special occasions. Choose your preferred style from their portfolios.',occasion:['party']},
  {id:'portrait-photography',name:'Portrait session',group:'photography',label:'Photographer',description:'A frame that feels like you.',detail:'Explore portrait photography for personal or professional use and find a visual style you love.',occasion:[]},
  {id:'bridal-hair',name:'Bridal hair styling',group:'hair',label:'Hair stylist',description:'The finishing touch to your big day.',detail:'Find bridal hair stylists and explore their work to complete your wedding look.',occasion:['wedding']},
  {id:'brand-content',name:'Brand content',group:'content',label:'Content creator',description:'Make your next idea stand out.',detail:'Connect with content creators for your brand. Explore the types of content they offer and their session prices.',occasion:['brand']},
  {id:'festive-makeup',name:'Festive makeup',group:'makeup',label:'Makeup artist',description:'Bring a little glow to the celebration.',detail:'Explore festive makeup services for celebrations and gatherings.',occasion:['party']},
  {id:'product-photography',name:'Product photography',group:'photography',label:'Photographer',description:'Put your products in the spotlight.',detail:'Find photographers for product shoots. Compare portfolios and discuss your requirements through the booking flow.',occasion:['brand']},
  {id:'video-editing',name:'Video editing',group:'editing',label:'Editor',description:'Turn your footage into a story.',detail:'Discover video editors, explore their samples and choose the editing service that fits your footage.',occasion:['brand']},
  {id:'reel-editing',name:'Reel editing',group:'editing',label:'Editor',description:'Short stories. A lasting impression.',detail:'Find editors for your short-form videos and reels. See the professional’s service scope and price in Artist House.',occasion:['brand']}
];
let activeFilter='all',query='',occasion='',audience='customer';
const grid=document.querySelector('#service-grid');
function renderServices(){
  const words=query.toLowerCase().replace(/\breels\b/g,'reel').trim().split(/\s+/).filter(Boolean);
  const filtered=services.filter(s=>(activeFilter==='all'||s.group===activeFilter)&&(!occasion||s.occasion.includes(occasion))&&words.every(w=>(s.name+' '+s.label+' '+s.group+' '+s.description).toLowerCase().includes(w)));
  grid.replaceChildren(...filtered.map(s=>{const button=document.createElement('button');button.className='service-card';button.setAttribute('aria-label','Explore '+s.name);button.innerHTML=`<div class="service-image"><img src="assets/${s.id}.webp" alt="${s.name} inspiration" loading="lazy" width="1000" height="1000"><span class="image-arrow" aria-hidden="true">↗</span></div><span class="service-category">${s.label}</span><h3>${s.name}</h3><p>${s.description}</p><span class="session-note">Explore session prices in the app ↗</span>`;button.addEventListener('click',()=>showService(s));return button;}));
  document.querySelector('#result-count').textContent=occasion?`${filtered.length} services for ${occasion==='wedding'?'your wedding':occasion==='party'?'your celebration':'your brand'}`:query?`${filtered.length} matching services`:`${filtered.length} services to make it happen`;
  document.querySelector('#empty-state').hidden=filtered.length!==0;
  document.querySelector('#clear-search').hidden=!query&&!occasion;
  document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===activeFilter);b.setAttribute('aria-pressed',String(b.dataset.filter===activeFilter));});
  grid.dispatchEvent(new CustomEvent('services:rendered'));
}
function scrollToServices(){document.querySelector('#services').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;occasion='';renderServices();}));
document.querySelector('#search-form').addEventListener('submit',e=>{e.preventDefault();query=document.querySelector('#service-search').value;activeFilter='all';occasion='';renderServices();scrollToServices();});
document.querySelectorAll('[data-query]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#service-search').value=b.dataset.query;document.querySelector('#search-form').requestSubmit();}));
document.querySelector('#clear-search').addEventListener('click',()=>{query='';occasion='';document.querySelector('#service-search').value='';renderServices();});
document.querySelectorAll('[data-occasion]').forEach(b=>b.addEventListener('click',()=>{occasion=b.dataset.occasion;activeFilter='all';query='';document.querySelector('#service-search').value='';renderServices();scrollToServices();}));
const dialog=document.querySelector('#detail-dialog'),content=document.querySelector('#dialog-content');
function openDialog(){dialog.showModal();document.body.style.overflow='hidden';}
function closeDialog(){dialog.close();}
dialog.addEventListener('close',()=>{document.body.style.overflow='';});
document.querySelector('.dialog-close').addEventListener('click',closeDialog);
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
function showService(s){content.innerHTML=`<img class="dialog-image" src="assets/${s.id}.webp" alt="${s.name} inspiration"><div class="dialog-body"><p class="eyebrow">${s.label}</p><h2 id="dialog-title">${s.name}</h2><p>${s.detail}</p><button class="button dark" id="service-app">Explore in Artist House <span>↗</span></button><small>Profiles, availability and per-session prices are shown in the app. Images on this page illustrate service types.</small></div>`;content.querySelector('#service-app').addEventListener('click',()=>{showApp('customer',false);});openDialog();}
function showApp(kind='customer',open=true){audience=kind;content.innerHTML=`<div class="dialog-body"><p class="eyebrow">WELCOME TO YOUR CIRCLE</p><h2 id="dialog-title">Good people.<br><em>One app away.</em></h2><p>Artist House is currently distributed as an Android APK. Ask our team for the latest installation link.</p><div class="app-choice"><button data-kind="customer">Customer app</button><button data-kind="professional">Professional app</button></div><a class="button dark" id="request-link">Request Android app <span>↗</span></a><small>This opens your email app. No email is sent automatically. A native iOS release is not available yet.</small></div>`;function update(){content.querySelectorAll('[data-kind]').forEach(b=>{b.classList.toggle('selected',b.dataset.kind===audience);b.setAttribute('aria-pressed',String(b.dataset.kind===audience));});content.querySelector('#request-link').href='mailto:support@cclabs.space?subject='+encodeURIComponent('Artist House '+audience+' app — Android access')+'&body='+encodeURIComponent('Hi Artist House team,\n\nPlease share the latest Android installation link for the '+audience+' app.\n\nThank you!');}content.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{audience=b.dataset.kind;update();}));update();if(open)openDialog();else content.querySelector('[data-kind="'+kind+'"]').focus();}
document.querySelectorAll('[data-app]').forEach(b=>b.addEventListener('click',()=>showApp(b.dataset.app)));
document.querySelectorAll('[data-audience]').forEach(b=>b.addEventListener('click',()=>{audience=b.dataset.audience;document.querySelectorAll('[data-audience]').forEach(tab=>{tab.classList.toggle('selected',tab===b);tab.setAttribute('aria-pressed',String(tab===b));});document.querySelector('#audience-description').textContent=audience==='customer'?'Explore portfolios, compare professionals and book your next session with Artist House Customer.':'Showcase your work, manage your service prices and follow your bookings with Artist House Professional.';}));
document.querySelector('#app-request').addEventListener('click',()=>showApp(audience));
const menu=document.querySelector('.menu-button'),nav=document.querySelector('#navigation');
function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
nav.querySelectorAll('a,button').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
document.querySelector('#year').textContent=new Date().getFullYear();
renderServices();
