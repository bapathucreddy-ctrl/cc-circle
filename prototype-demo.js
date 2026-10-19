/* Presentation-only demo: no SMS, remote accounts, payments or imported personal data. */
const previewAssets={Makeup:'makeup',Actor:'actor',Photographer:'photographer',Editor:'editor',Dancer:'dancer'};
function previewPhoto(role,index=0,extra=''){return '<img class="portfolio-photo" src="prototype-assets/'+previewAssets[role]+'.png" alt="Generated sample '+labels[role].toLowerCase()+' portfolio preview" '+extra+' style="object-position:'+([50,35,65,50][index%4])+'% center" loading="lazy">'}
const originalCard=card;
card=function(role,index){return originalCard(role,index).replace(prop(role)+prop(role),previewPhoto(role,index));};
const originalProfile=profile;
profile=function(){let html=originalProfile();html=html.replace('<div class="cover">'+prop(state.category),'<div class="cover">'+previewPhoto(state.category,state.person));return html.replaceAll(prop(state.category)+'<span>',previewPhoto(state.category,state.person)+'<span>');};
portfolioSheet=function(index){openSheet(definitions[state.category].works[index],'<div class="cover" style="height:220px">'+previewPhoto(state.category,index)+'</div><p class="muted small">Generated sample work · '+labels[state.category]+'</p><p class="muted small">This photo demonstrates portfolio presentation. It is not work by the listed sample professional, nor imported from a connected account.</p>');};

function setDesign(design){state.design=['soft','minimal','neumorphic'].includes(design)?design:'soft';document.body.dataset.design=state.design;document.getElementById('design-style').value=state.design;try{localStorage.setItem('cc-circle-design',state.design)}catch{}if(state.screen==='designs')render();}
function themeSheet(){openSheet('Demo appearance','<p class="muted small">Compare the same workflow in three styles and two color modes.</p><div class="auth-kind">'+['light','dark'].map(t=>'<button class="'+(state.theme===t?'selected':'')+'" onclick="setTheme(\''+t+'\');themeSheet()">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div>'+['soft','minimal','neumorphic'].map(d=>'<button class="account-link" onclick="setDesign(\''+d+'\');closeSheet()"><span>'+({soft:'Soft Studio · current',minimal:'Minimal · previous',neumorphic:'Neumorphic · sculpted'}[d])+'</span><span>'+(state.design===d?'✓':'→')+'</span></button>').join(''));}
function demoSettings(){return '<div class="demo-settings"><span class="eyebrow">CC CIRCLE / PREVIEW</span><button class="text-btn" onclick="themeSheet()">Appearance ◐</button></div>';}
function welcomeRow(reverse=false){const items=reverse?['Editor','Dancer','Makeup','Actor','Photographer']:roles;return '<div class="photo-marquee '+(reverse?'reverse':'')+'"><div class="photo-track">'+[0,1].map(copy=>items.map((role,i)=>'<figure class="welcome-photo" '+(copy?'aria-hidden="true"':'')+'>'+previewPhoto(role,i).replace('loading="lazy"','loading="eager"')+'<figcaption>'+labels[role]+'</figcaption></figure>').join('')).join('')+'</div></div>';}
function welcome(){return '<div class="welcome-screen">'+demoSettings()+welcomeRow()+welcomeRow(true)+'<div class="welcome-copy"><span class="welcome-wordmark">cc. circle</span><h1>Your people.<br>Your next great project.</h1><p>Find creative talent nearby.<br>Explore their work. Book your perfect match.</p></div><div class="auth-panel"><button class="primary" onclick="startAuth(\'signup\')">Get started '+icon('arrow')+'</button><button class="secondary" onclick="startAuth(\'login\')">I already have an account</button><p>Your portfolio already lives online.<br>Bring it into your circle.</p></div><div class="auth-footer"><button onclick="legalSheet(\'Terms of service\')">Terms of service</button> · <button onclick="legalSheet(\'Privacy policy\')">Privacy policy</button><br><button id="motion-toggle" onclick="togglePhotoMotion()">'+(document.body.dataset.motion==='paused'?'Play':'Pause')+' photo motion</button> · Generated demo photos</div></div>';}
function togglePhotoMotion(){document.body.dataset.motion=document.body.dataset.motion==='paused'?'playing':'paused';document.getElementById('motion-toggle').textContent=(document.body.dataset.motion==='paused'?'Play':'Pause')+' photo motion';}
function legalSheet(title){openSheet(title,'<p class="muted small">Prototype notice: this is a design demonstration, not a live service. No authentication, SMS, payment or account creation occurs. Enter fictional information only; form data stays in memory until this page is reloaded.</p>');}
function startAuth(mode){state.authMode=mode;state.authKind=state.authKind||'client';go('auth');}
function auth(){return '<div class="auth-screen">'+head(state.authMode==='login'?'Welcome back':'Join your circle','welcome')+previewPhoto('Photographer',0,'').replace('class="portfolio-photo"','class="auth-hero-photo"')+'<h1>'+(state.authMode==='login'?'Good to see<br>you again.':'One number.<br>A whole creative circle.')+'</h1><p>Continue with your mobile number to '+(state.authMode==='login'?'access your bookings.':'find talent or offer your services.')+'</p><div class="auth-kind"><button class="'+(state.authKind==='client'?'selected':'')+'" onclick="state.authKind=\'client\';render()">I’m booking talent</button><button class="'+(state.authKind==='professional'?'selected':'')+'" onclick="state.authKind=\'professional\';render()">I’m a professional</button></div><form onsubmit="requestDemoOtp(event)"><div class="form-field"><label for="auth-phone">Mobile number</label><div class="phone-field"><span>+91</span><input id="auth-phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" pattern="[6-9][0-9]{9}" maxlength="10" placeholder="98765 43210" value="'+escape(state.demoPhone||'')+'" required></div></div><p id="auth-error" class="signup-error" role="alert"></p><button class="primary full" type="submit">Continue '+icon('arrow')+'</button></form><div class="demo-disclaimer">Demo only. Use a fictional 10-digit number. No SMS is sent; the verification code is 123456.</div><button class="text-btn full" onclick="go(\'home\')">Explore the demo without signing in</button></div>';}
function requestDemoOtp(event){event.preventDefault();state.demoPhone=document.getElementById('auth-phone').value.replace(/\s/g,'');go('verify');}
function verify(){return '<div class="auth-screen">'+head('Verify your number','auth')+'<div class="welcome-wordmark" style="margin-top:20px">cc. circle</div><h1>You’re one step<br>from your circle.</h1><p>Demo verification for +91 '+escape((state.demoPhone||'').slice(0,2))+'••••••'+escape((state.demoPhone||'').slice(-2))+'. No SMS has been sent.</p><form onsubmit="verifyDemoOtp(event)"><div class="form-field"><label for="auth-code">6-digit verification code</label><input id="auth-code" class="otp-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required placeholder="••••••"></div><p id="auth-error" class="signup-error" role="alert"></p><button class="primary full" type="submit">'+(state.authKind==='professional'?'Build my professional profile':'Enter my circle')+' '+icon('arrow')+'</button></form><div class="demo-disclaimer">Use 123456 for this preview. This does not verify a real phone number.</div><button class="text-btn full" onclick="toast(\'Demo code: 123456. No SMS sent.\')">Resend demo code</button><button class="text-btn full" onclick="go(\'auth\')">Change mobile number</button></div>';}
function verifyDemoOtp(event){event.preventDefault();if(document.getElementById('auth-code').value!=='123456'){document.getElementById('auth-error').textContent='Use the demo code 123456.';return}state.demoSignedIn=true;if(state.authKind==='professional'){state.joinStep=1;go('join')}else go('home');toast('Demo sign-in complete');}

// Fields are job-relevant; physical measurements are optional and private.
const choice=(id,label,options,required=false)=>({id,label,type:'select',options,required});
const multi=(id,label,options,required=false)=>({id,label,type:'multi',options,required});
const textQuestion=(id,label,hint='',required=false)=>({id,label,type:'text',hint,required});
const numberQuestion=(id,label,min,max,hint='',privateField=false)=>({id,label,type:'number',min,max,hint,privateField});
const longQuestion=(id,label,hint='')=>({id,label,type:'textarea',hint});
const sectionQuestions=(title,description,fields)=>({title,description,fields});
const detailedQuestions={
Photographer:[
sectionQuestions('Your photography practice','Tell clients what you shoot and how you work.',[
multi('genres','What do you shoot?',['Wedding','Portrait','Product','Fashion','Events','Architecture','Food','Documentary'],true),
choice('experience','Professional experience',['Under 1 year','1–2 years','3–5 years','6–10 years','10+ years'],true),
multi('style','Your visual style',['Candid','Editorial','Traditional','Fine art','Documentary','Studio','Lifestyle']),
multi('clients','Projects you take',['Individuals','Weddings','Brands','Film productions','Agencies','Corporate']),
multi('languages','Client communication languages',['English','Hindi','Kannada','Tamil','Telugu','Malayalam','Other']),
choice('team','Usual team size',['Solo','Photographer + assistant','2 photographers','3–5 crew','Custom crew']),
textQuestion('training','Training or certifications','Optional: degree, courses or workshops'),
longQuestion('credits','Selected clients / project credits','Only mention credits you can publicly share')]),
sectionQuestions('Cameras, lenses & lighting','Share your actual kit, not just “professional camera”.',[
multi('camera-brands','Camera brands you use',['Canon','Sony','Nikon','Fujifilm','Panasonic','Leica','Hasselblad','Other'],true),
textQuestion('camera-models','Camera body models','e.g. Sony A7 IV; Canon EOS R6 Mark II',true),
choice('sensor','Primary camera sensor',['Full-frame','APS-C','Micro Four Thirds','Medium format','Other']),
textQuestion('lenses','Lens models & focal lengths','e.g. 24–70mm f/2.8, 50mm f/1.8'),
multi('lighting','Lighting available',['Speedlight','Studio strobes','Continuous LEDs','Softboxes','Reflectors','Portable battery kit','None']),
choice('backup','Backup camera / memory setup',['Spare body + dual-card recording','Spare body','Dual-card recording','Rental backup','No backup currently']),
textQuestion('drone','Drone model, if offered','Leave blank if you do not offer drone work'),
choice('drone-clearance','Drone work readiness',['Not offered','Pilot credentials & permissions arranged per job','Working with a qualified drone partner']),
multi('support-gear','Additional equipment',['Tripod','Gimbal','Tethering setup','Backdrop kit','Audio recorder','Underwater housing']),
choice('kit-included','Equipment pricing',['Own basic kit included','Equipment charged separately','Depends on package'])]),
sectionQuestions('Editing & delivery','Set clear expectations before someone books.',[
multi('editing-software','Editing tools',['Lightroom','Photoshop','Capture One','Luminar','Other']),
multi('file-formats','Delivery formats',['JPEG','PNG','TIFF','Print-ready files','RAW on agreement']),
numberQuestion('photo-count','Typical edited images per shoot',1,10000,'e.g. 20'),
choice('turnaround','Usual delivery time',['Same day','24–48 hours','3–5 days','7 days','14 days','Project-specific'],true),
choice('revisions','Included revision rounds',['None','1 round','2 rounds','3 rounds','By agreement']),
choice('delivery-method','How do you deliver?',['Private online gallery','Cloud download link','Physical drive','Client preference']),
choice('raw-policy','RAW / original files policy',['Not included','Available at extra cost','Included by agreement']),
choice('usage','Image usage rights',['Personal use','Commercial usage quoted separately','Client-specific license']),
choice('retention','Gallery / backup retention',['30 days','90 days','6 months','1 year','By agreement'])]),
sectionQuestions('Shoot logistics','Help us match you with suitable bookings.',[
multi('locations','Where can you shoot?',['Client location','Own studio','Rental studio','Outdoor','Travel assignments']),
choice('studio','Studio access',['Own studio','Partner studio','Rental on request','No studio']),
textQuestion('studio-equipment','Studio facilities','Backdrop sizes, lighting and changing area'),
choice('notice','Minimum booking notice',['Instant if available','4 hours','24 hours','3 days','1 week']),
choice('overtime','Overtime policy',['Hourly extra','Half-day extra','By agreement','Not offered']),
choice('travel-kit','Transport for gear',['Own transport','Client transport required','Travel cost quoted separately']),
longQuestion('client-prep','What should a client prepare?','Moodboard, shot list, wardrobe or permissions'),
longQuestion('shoot-boundaries','Booking limits / special requirements','Projects you do not take, setup needs or accessibility preferences')])],
Makeup:[
sectionQuestions('Your makeup expertise','Define the looks and clients you work with.',[
multi('services','Your services',['Bridal','Party','Editorial','Film / TV','SFX','Grooming','Hair styling','Draping'],true),
choice('experience','Professional experience',['Under 1 year','1–2 years','3–5 years','6–10 years','10+ years'],true),
multi('techniques','Techniques you offer',['HD makeup','Airbrush','Natural finish','Full glam','Mature-skin makeup','Stage makeup','Prosthetics']),
multi('events','Booking types',['Weddings','Pre-wedding','Events','Fashion shoots','Film sets','Lessons']),
textQuestion('training','Certifications / training','Academy, mentor or course'),
multi('languages','Languages',['English','Hindi','Kannada','Tamil','Telugu','Other']),
choice('team','Team setup',['Solo','With hairstylist','With assistant','Full bridal team']),
longQuestion('signature','Describe your signature style')]),
sectionQuestions('Your kit & hygiene','Products and preparation matter as much as the finished look.',[
multi('kit-brands','Brands in your kit',['MAC','Huda Beauty','NARS','Charlotte Tilbury','Kryolan','Make Up For Ever','Other'],true),
textQuestion('base-products','Foundation / base products','Main ranges and shade availability'),
multi('kit-tools','Tools you bring',['Brush kit','Airbrush machine','Ring light','Makeup chair','Hair tools','Portable mirror']),
multi('hygiene','Hygiene practices',['Sanitized tools','Disposable applicators','Fresh sponges','No double dipping','Kit cleaning between bookings']),
choice('skin-prep','Skin preparation',['Included','Client prepares','Discuss before booking']),
choice('sensitive-skin','Product sensitivity process',['Consultation before booking','Patch test on request','Client-supplied products accepted']),
choice('cruelty-free','Cruelty-free kit option',['Available','Partially available','Not currently offered']),
textQuestion('special-products','Special products / requests','Fragrance-free options or client-provided products')]),
sectionQuestions('Looks, trials & timing','Make your package inclusions unambiguous.',[
numberQuestion('look-minutes','Minutes for one makeup look',15,360,'e.g. 90'),
numberQuestion('people-per-day','Maximum clients per day',1,30),
choice('trial','Trial session policy',['Included','Paid trial','On request','Not offered']),
multi('inclusions','Package inclusions',['Lashes','Hair styling','Draping','Touch-up kit','Accessories placement','None']),
choice('touch-ups','On-site touch-ups',['Included limited time','Hourly extra','Not offered']),
choice('look-changes','Additional look changes',['Available at extra cost','Included in package','Not offered']),
textQuestion('assistant-fee','Assistant / hairstylist charges','Explain when extra charges apply'),
longQuestion('prep','Client preparation checklist','Skincare, clean hair, lighting or seating needs')]),
sectionQuestions('Your working setup','Capture travel, workspace and event requirements.',[
multi('workplaces','Where do you work?',['Client venue','Own studio','Hotel','Film location','Salon']),
choice('travel','Travel bookings',['Local only','Outstation available','Destination events available']),
choice('early-start','Early-morning bookings',['Available','Extra charge','Not available']),
choice('lead-time','Minimum notice',['Instant if available','24 hours','3 days','1 week']),
choice('space','Workspace requirements',['Bring full setup','Well-lit table & power required','Discuss per venue']),
choice('consultation','Pre-booking consultation',['Video call','In-app chat','In-person paid consultation']),
longQuestion('portfolio-credits','Relevant event / production credits'),
longQuestion('limitations','Service boundaries & special requirements')])],
Actor:[
sectionQuestions('Your performance profile','Actors and models can tailor their casting profile.',[
choice('performer-type','Your primary focus',['Actor','Model','Actor & model','Voice artist','Stage performer'],true),
multi('work-types','Types of work',['Film','TV / web series','Commercials','Theatre','Fashion','Runway','E-commerce','Voiceover'],true),
choice('experience','Professional experience',['New talent','1–2 years','3–5 years','6–10 years','10+ years']),
multi('languages','Performance languages',['English','Hindi','Kannada','Tamil','Telugu','Malayalam','Other']),
textQuestion('dialects','Accents / dialects','Only those you can perform confidently'),
choice('playing-age','Adult playing age',['18–25','25–35','35–45','45–60','60+']),
textQuestion('training','Acting / modelling training'),
longQuestion('credits','Selected credits / productions')]),
sectionQuestions('Casting & wardrobe details','Optional fitting details for relevant jobs. These are private, not public search filters.',[
choice('gender','Gender / casting identity (optional)',['Woman','Man','Non-binary','Self-describe in notes','Prefer not to say']),
numberQuestion('height','Height (cm)',100,250,'Optional',true),
numberQuestion('chest','Bust / chest (cm)',40,200,'Optional — all genders',true),
numberQuestion('waist','Waist (cm)',35,200,'Optional',true),
numberQuestion('hips','Hip (cm)',40,220,'Optional',true),
textQuestion('clothing-size','Usual clothing size','e.g. S / M / L, or your preferred sizing system'),
textQuestion('shoe-size','Shoe size & sizing system','e.g. UK 6 / EU 39'),
textQuestion('hair','Hair length / current look','Optional, for continuity and styling'),
longQuestion('fitting-notes','Wardrobe / fitting notes','Any details you choose to share for a booked job'),
choice('share-fitting','Sharing preference',['Keep private','Share selected details after confirming a relevant job'])]),
sectionQuestions('Skills & audition readiness','Show the abilities that matter for casting.',[
multi('skills','Performance skills',['Dance','Singing','Action / stage combat','Comedy','Improvisation','Presenting','Instruments','None']),
multi('modelling','Modelling experience',['Runway','Editorial','E-commerce','Beauty','Fitness','Not applicable']),
choice('self-tape','Self-tape availability',['Same day','Within 48 hours','Within a week','By agreement']),
multi('audition-material','Materials available',['Showreel','Headshots','Full-length photos','Voice demo','Self-tape setup']),
choice('voice-studio','Voice recording setup',['Own treated studio','Home recording setup','External studio','Not applicable']),
textQuestion('special-skills','Specific skills / proficiency','e.g. piano intermediate, swimming competent'),
textQuestion('agency','Representation / agency','Optional; no private contact details'),
longQuestion('reel-notes','What should a casting team know?')]),
sectionQuestions('Booking preferences & consent','Your boundaries are respected; no sensitive details are required.',[
choice('schedule','Typical availability',['Weekdays','Weekends','Flexible','Project-dependent']),
choice('travel','Travel availability',['Local only','Domestic travel','International by agreement']),
choice('shoot-day','Standard shoot day',['4 hours','8 hours','10 hours','12 hours','By agreement']),
choice('usage','Commercial usage policy',['Quoted per campaign','Limited-term license','Discuss before booking']),
choice('exclusivity','Exclusivity terms',['Non-exclusive','Campaign-specific','Agency approval required']),
choice('audition-format','Preferred audition format',['Self-tape','Online','In person','Any']),
longQuestion('boundaries','Role / wardrobe / performance boundaries','Optional. Share only what helps establish your professional consent.'),
longQuestion('access-needs','On-set requirements','Optional practical requirements; do not include medical details')])],
Editor:[
sectionQuestions('Your editing expertise','Match with the right format, not just “an editor”.',[
multi('specialisms','Core expertise',['Video editing','Color grading','Motion graphics','Photo retouching','VFX','Sound cleanup','Subtitling'],true),
multi('formats','Content formats',['Reels / shorts','YouTube','Wedding films','Ads','Documentary','Film / series','Corporate']),
choice('experience','Professional experience',['Under 1 year','1–2 years','3–5 years','6–10 years','10+ years'],true),
multi('languages','Editing / subtitle languages',['English','Hindi','Kannada','Tamil','Telugu','Other']),
textQuestion('training','Training / certifications'),
longQuestion('credits','Selected credits'),
choice('collaboration','Working mode',['Remote','On-site','Hybrid']),
choice('team','Team setup',['Solo','With motion designer','With colorist','Full post-production team'])]),
sectionQuestions('Software & workstation','Specify your tools and supported workflows.',[
multi('software','Editing software',['Premiere Pro','DaVinci Resolve','Final Cut Pro','Avid','After Effects','Photoshop','Blender'],true),
textQuestion('software-version','Software versions / plugins','e.g. Resolve Studio; your usual plugins'),
choice('platform','Workstation platform',['Windows','macOS','Linux','Multiple']),
textQuestion('workstation','CPU / GPU / RAM','e.g. Apple M3 Pro, 36GB RAM'),
choice('max-resolution','Comfortable source resolution',['1080p','4K','6K','8K','Depends on footage']),
multi('codecs','Supported workflows',['H.264 / H.265','ProRes','BRAW','R3D','Image sequences','Proxy workflow']),
choice('monitor','Color monitoring',['Calibrated reference monitor','Calibrated computer display','Standard display']),
textQuestion('storage','Storage / backup workflow','No device identifiers or private account links')]),
sectionQuestions('Deliverables & revisions','Define exactly what your client receives.',[
multi('exports','Export formats',['MP4','MOV / ProRes','Image sequence','GIF','WAV','SRT']),
multi('ratios','Aspect ratios',['9:16','16:9','1:1','4:5','Custom']),
choice('project-files','Project files policy',['Included','Extra cost','Not included','By agreement']),
choice('revision-rounds','Included revisions',['1 round','2 rounds','3 rounds','By agreement']),
choice('turnaround','Typical turnaround',['24 hours','48 hours','3–5 days','1 week','Project-specific'],true),
choice('captions','Captions / subtitles',['Included','Add-on','Not offered']),
choice('licensed-assets','Music / stock assets',['Client provides licensed assets','Licensed assets quoted separately','Included limited library']),
choice('retention','Project retention',['30 days','90 days','6 months','By agreement'])]),
sectionQuestions('Project handoff','Avoid preventable friction in every edit.',[
choice('upload','Footage handoff',['Cloud link','Physical drive','Both']),
choice('feedback','Feedback workflow',['Timecoded comments','In-app brief','Review platform','Client preference']),
choice('rush','Rush projects',['Available at extra charge','If schedule allows','Not available']),
choice('source-limit','Package footage limit',['Up to 30 minutes','Up to 2 hours','Up to 8 hours','Quoted individually']),
choice('duration-limit','Typical output length',['Under 60 seconds','1–5 minutes','5–30 minutes','Long-form']),
longQuestion('brief','What does your client need to provide?','Brief, references, music rights, footage and brand assets'),
longQuestion('scope','What is outside your base package?'),
longQuestion('security','Confidentiality / file-handling preferences')])],
Dancer:[
sectionQuestions('Your dance practice','Tell us your styles, roles and experience.',[
multi('styles','Dance styles',['Bollywood','Contemporary','Hip-hop','Bharatanatyam','Kathak','Salsa','Jazz','Other'],true),
multi('services','Services',['Live performance','Choreography','Wedding choreography','Teaching','Music videos','Film shoots'],true),
choice('experience','Professional experience',['Under 1 year','1–2 years','3–5 years','6–10 years','10+ years']),
choice('setup','Performance setup',['Solo','Duo','Crew','Flexible']),
numberQuestion('crew-count','Available crew size',1,100),
textQuestion('training','Training / certifications'),
multi('languages','Teaching / coordination languages',['English','Hindi','Kannada','Tamil','Telugu','Other']),
longQuestion('credits','Selected stages / production credits')]),
sectionQuestions('Performance & choreography','Describe the scope of your act.',[
numberQuestion('set-duration','Typical performance duration (minutes)',1,180),
numberQuestion('rehearsals','Rehearsals usually required',0,60),
choice('custom-routine','Custom choreography',['Available','Limited customization','Existing acts only']),
multi('events','Event types',['Weddings','Stage shows','Corporate','Festivals','Film / music video','Private lessons']),
choice('teaching-mode','Teaching format',['In person','Online','Both','Not offered']),
choice('teaching-level','Teaching level',['Beginners','Intermediate','Advanced','All levels','Not offered']),
choice('costumes','Costume support',['Included','Extra charge','Client provides','Discuss per routine']),
choice('music-edit','Music editing',['Included','Extra charge','Client provides track'])]),
sectionQuestions('Stage & equipment','Capture the practical needs of your performance.',[
textQuestion('stage-size','Minimum performance space','e.g. 4m × 4m'),
multi('flooring','Suitable floor types',['Wood','Marley','Carpet','Smooth indoor floor','Outdoor stage']),
multi('tech-needs','Technical requirements',['Sound system','Stage lights','Wireless mic','Playback operator','None']),
choice('props','Props support',['Bring own props','Client arranges','Not needed']),
choice('changing-area','Changing / preparation area',['Required','Preferred','Not needed']),
numberQuestion('setup-time','Setup time (minutes)',0,180),
choice('outdoor','Outdoor performances',['Available','Weather dependent','Indoor only']),
longQuestion('stage-notes','Stage safety / setup notes','Floor condition, clear space and equipment requirements')]),
sectionQuestions('Rehearsals & bookings','Set expectations for timing and coordination.',[
choice('notice','Booking lead time',['Instant existing act','24 hours','3 days','1 week','2+ weeks']),
choice('travel','Travel availability',['Local only','Domestic','Destination events by agreement']),
choice('rehearsal-place','Rehearsal location',['Own studio','Client space','Rental studio','Online']),
choice('extra-rehearsal','Extra rehearsal policy',['Hourly extra','Session extra','By agreement']),
choice('recording','Performance recording',['Personal recording allowed','Commercial rights negotiated','Ask before recording']),
choice('cancellation','Rescheduling preference',['24-hour notice','48-hour notice','Project-specific']),
longQuestion('client-prep','Client preparation checklist'),
longQuestion('boundaries','Performance boundaries / special requirements')])]
};

state.roleDetails={};state.detailPage=0;state.detailComplete={};
function detailDraft(){return state.roleDetails[state.joinRole]||(state.roleDetails[state.joinRole]={});}
function detailField(q){const name='detail-'+q.id,value=detailDraft()[q.id],privateHint=q.privateField?'Optional · private casting detail':q.required?'Required':q.hint||'Optional';const label=escape(q.label)+'<small>'+escape(privateHint)+'</small>';if(q.type==='multi')return '<fieldset class="detail-field"><legend>'+label+'</legend><div class="signup-options">'+q.options.map(o=>'<label><input type="checkbox" name="'+name+'" value="'+escape(o)+'" '+(Array.isArray(value)&&value.includes(o)?'checked':'')+'><span>'+escape(o)+'</span></label>').join('')+'</div></fieldset>';let input;if(q.type==='select')input='<select id="'+name+'" name="'+name+'" '+(q.required?'required':'')+'><option value="">'+(q.required?'Choose an option':'Skip / prefer not to answer')+'</option>'+q.options.map(o=>'<option '+(value===o?'selected':'')+'>'+escape(o)+'</option>').join('')+'</select>';else if(q.type==='textarea')input='<textarea id="'+name+'" name="'+name+'" maxlength="1000" placeholder="'+escape(q.hint||'Optional notes')+'">'+escape(value||'')+'</textarea>';else input='<input id="'+name+'" name="'+name+'" type="'+q.type+'" '+(q.type==='number'?'min="'+q.min+'" max="'+q.max+'" step="0.1" inputmode="decimal"':'maxlength="250"')+' '+(q.required?'required':'')+' value="'+escape(value||'')+'" placeholder="'+escape(q.hint||'')+'">';return '<div class="detail-field"><label for="'+name+'">'+label+'</label>'+input+'</div>';}
function saveDetailDraft(){const form=document.getElementById('detail-form');if(!form)return;const data=new FormData(form),draft=detailDraft();detailedQuestions[state.joinRole][state.detailPage].fields.forEach(q=>draft[q.id]=q.type==='multi'?data.getAll('detail-'+q.id):String(data.get('detail-'+q.id)||'').trim());if(detailedQuestions[state.joinRole].some(s=>s.fields.some(q=>q.required&&!(Array.isArray(draft[q.id])?draft[q.id].length:draft[q.id]))))state.detailComplete[state.joinRole]=false;}
function openSpecifications(){saveJoinDraft();state.detailPage=0;go('specifications');}
function specifications(){const sections=detailedQuestions[state.joinRole],s=sections[state.detailPage];return head(labels[state.joinRole]+' details','join')+'<div class="question-progress" aria-label="Questionnaire progress">'+sections.map((x,i)=>'<button class="'+(i===state.detailPage?'current':i<state.detailPage?'done':'')+'" aria-label="Section '+(i+1)+'" onclick="detailJump('+i+')"></button>').join('')+'</div><div class="question-heading"><span class="eyebrow">'+labels[state.joinRole]+' / SECTION '+(state.detailPage+1)+' OF '+sections.length+'</span><h1>'+s.title+'</h1><p>'+s.description+'</p></div>'+(state.joinRole==='Actor'&&state.detailPage===1?'<div class="private-note">'+icon('shield')+'All measurements are optional, for adult casting / wardrobe only. Nothing here is shown on public profiles. Sharing requires your choice after a relevant booking.</div>':'')+'<form id="detail-form" onsubmit="detailNext(event)">'+s.fields.map(detailField).join('')+'<p id="detail-error" class="signup-error" role="alert"></p><button class="primary full" type="submit">'+(state.detailPage===sections.length-1?'Save professional details':'Continue to '+sections[state.detailPage+1].title.toLowerCase())+' '+icon('arrow')+'</button><button class="text-btn full" type="button" onclick="detailBack()">'+(state.detailPage?'Previous questions':'Save draft & return to signup')+'</button></form><p class="signup-helper">Optional questions can be skipped. Demo answers remain in this page’s memory only.</p>';}
function detailJump(index){saveDetailDraft();state.detailPage=index;render();document.getElementById('view').scrollTop=0;}
function detailBack(){saveDetailDraft();if(state.detailPage){state.detailPage--;render();document.getElementById('view').scrollTop=0}else go('join');}
function detailNext(event){event.preventDefault();saveDetailDraft();const s=detailedQuestions[state.joinRole][state.detailPage],missing=s.fields.find(q=>q.required&&!(Array.isArray(detailDraft()[q.id])?detailDraft()[q.id].length:detailDraft()[q.id]));if(missing){document.getElementById('detail-error').textContent='Please answer: '+missing.label;return}if(state.detailPage<3){state.detailPage++;render();document.getElementById('view').scrollTop=0;return}const allMissing=detailedQuestions[state.joinRole].findIndex(s=>s.fields.some(q=>q.required&&!(Array.isArray(detailDraft()[q.id])?detailDraft()[q.id].length:detailDraft()[q.id])));if(allMissing!==-1){state.detailPage=allMissing;render();document.getElementById('detail-error').textContent='Complete the required answers in this section.';return}state.detailComplete[state.joinRole]=true;state.joinStep=2;go('join');toast('Detailed specifications saved for this demo');}
const originalJoinTwo=joinTwo;
joinTwo=function(){return originalJoinTwo().replace('<form id="signup-form"','<div class="detail-intro neu"><h3>Your craft, in detail.</h3><p>'+({Photographer:'Camera brands and models, lenses, lighting, editing workflow and delivery.',Makeup:'Kit brands, techniques, hygiene, look timings and event requirements.',Actor:'Acting or modelling, casting details, skills and booking consent.',Editor:'Software, workstation, codecs, export formats and project handoff.',Dancer:'Dance styles, choreography, stage setup and rehearsal requirements.'}[state.joinRole])+'</p><div class="detail-badges">'+detailedQuestions[state.joinRole].map(s=>'<span>'+s.title+'</span>').join('')+'</div><button class="primary full" onclick="openSpecifications()">'+(state.detailComplete[state.joinRole]?'Edit':'Add')+' detailed specifications '+icon('arrow')+'</button>'+(state.detailComplete[state.joinRole]?'<p class="details-complete">✓ Required details complete · optional answers can be added later</p>':'<p>4 focused question pages · draft retained when you return</p>')+'</div><form id="signup-form"');};
const originalJoinNext=joinNext;
joinNext=function(event,next){if(state.joinStep===2&&!state.detailComplete[state.joinRole]){event.preventDefault();saveJoinDraft();signupError('Complete your dedicated professional questionnaire first.');return}originalJoinNext(event,next);};
const originalJoinReview=joinReview;
joinReview=function(){return originalJoinReview().replace('<div class="trust" style="margin-bottom:20px">','<div class="signup-review neu"><div class="row"><h3>Detailed specifications</h3><button class="text-btn" onclick="openSpecifications()">Edit</button></div><p class="muted small">'+Object.values(detailDraft()).filter(v=>Array.isArray(v)?v.length:v).length+' questions answered across 4 sections.</p>'+(state.joinRole==='Actor'?'<p class="private-note">Casting measurements and wardrobe details stay private. Public profiles will not include them.</p>':'<p class="muted small">Job-relevant tools and skills help clients find a suitable match.</p>')+'</div><div class="trust" style="margin-bottom:20px">');};
// Replace the legacy mandatory public height question with a non-sensitive skill field.
definitions.Actor.specs[3]=['Audition readiness','select',['Self-tape available','In-person audition','Both']];
const originalAccount=account;
account=function(){return originalAccount()+'<button class="account-link" onclick="go(\'welcome\')"><span>Welcome / demo sign-in</span>'+icon('user')+'</button><button class="account-link" onclick="go(\'designs\')"><span>Compare design styles</span>'+icon('chevron')+'</button><button class="account-link" onclick="themeSheet()"><span>Light / dark & appearance</span>'+icon('chevron')+'</button><button class="account-link" onclick="startTravelDemo()"><span>Try 3D travel</span>'+icon('pin')+'</button>';};
function designs(){return head('Design showroom','account')+'<h1 class="title">Same circle.<br>Three directions.</h1><p class="muted small">Change the style without losing your booking or signup draft. Each direction supports light and dark.</p><div class="auth-kind">'+['light','dark'].map(t=>'<button class="'+(state.theme===t?'selected':'')+'" onclick="setTheme(\''+t+'\');render()">'+t[0].toUpperCase()+t.slice(1)+'</button>').join('')+'</div>'+[['soft','Soft Studio','Airy lavender, rounded cards and subtle elevation.'],['minimal','Minimal','Clean borders, blue accents and functional surfaces.'],['neumorphic','Neumorphic','Sculpted surfaces, tactile controls and inset fields.']].map(([id,label,desc])=>'<div class="design-card"><div class="row"><h3>'+label+'</h3><span class="tiny muted">'+(state.design===id?'SELECTED':'')+'</span></div><div class="mini-scene design-mini-'+id+'"><div></div><div></div><span><i></i><i></i><i></i></span></div><p>'+desc+'</p><button class="primary" onclick="setDesign(\''+id+'\');go(\'welcome\')">Try '+label+' →</button></div>').join('');}

const originalRender=render;
render=function(){originalRender();const authPage=['welcome','auth','verify'].includes(state.screen);document.getElementById('view').classList.toggle('auth-viewport',authPage);document.getElementById('tabs').style.display=authPage?'none':'';if(authPage){document.getElementById('active-booking').innerHTML='';document.getElementById('compare-tray').innerHTML='';}};
const originalGo=go;
go=function(screen){if(state.screen==='specifications')saveDetailDraft();if(state.screen==='join'&&screen!=='join')saveJoinDraft();originalGo(screen);};
initTheme();let initialDesign='soft';try{initialDesign=localStorage.getItem('cc-circle-design')||'soft'}catch{}setDesign(initialDesign);state.screen='welcome';
const demoParams=new URLSearchParams(location.search);
if(demoParams.has('design'))setDesign(demoParams.get('design'));
if(demoParams.has('theme'))setTheme(demoParams.get('theme'));
if(roles.includes(demoParams.get('role')))state.category=state.joinRole=demoParams.get('role');
if(['welcome','auth','home','discover','designs','join','specifications','profile'].includes(demoParams.get('screen')))state.screen=demoParams.get('screen');
if(state.screen==='specifications'){state.joinStep=2;state.detailPage=Math.min(3,Math.max(0,Number(demoParams.get('section'))||0));}
render();
