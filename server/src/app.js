import {imageIdentity,isPortfolioImage} from '../../src/lib/media.ts';
import express from 'express';
import {marketplaceRoutes} from './marketplace.js';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import {createHash,randomBytes,randomUUID,scryptSync,timingSafeEqual} from 'node:crypto';
import {mkdirSync,unlinkSync,existsSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {crafts,mediaKey} from './db.js';
import {discoverMedia,publicUrl} from './media.js';
import {youtubeAuthUrl,exchangeYouTubeCode,loadYouTubeVideos} from './youtube.js';
import {instagramAuthUrl,exchangeInstagramCode,loadInstagramMedia} from './instagram.js';

const id=()=>randomUUID();
const hash=v=>createHash('sha256').update(v).digest('hex');
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!!u.hostname.includes('.')&&v.length<=2048}catch{return false}};
const secret=v=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(v,salt,64).toString('hex')}`};
const validSecret=(v,stored)=>{const [salt,expected]=stored.split(':');if(!salt||!expected)return false;const a=scryptSync(v,salt,64),b=Buffer.from(expected,'hex');return a.length===b.length&&timingSafeEqual(a,b)};
const publicUser=u=>({id:u.id,name:u.name,city:u.city,category:u.category,bio:u.bio,avatar:u.avatar,availability:u.availability,verification:u.verification,role:u.role,day_rate:u.day_rate,crafts:JSON.parse(u.crafts||'[]'),specialties:u.specialties,experience:u.experience,rate:u.rate,credits:u.credits,available_from:u.available_from,available_until:u.available_until});
const must=(ok,code,message)=>{if(!ok){const e=new Error(message);e.status=code;throw e}};
const imgType=bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'image/jpeg':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;

export function createApp(db,{uploadRoot=resolve('data/uploads'),allowedOrigins=['http://localhost:8081','http://localhost:19006'],bootstrapAdminEmail,bootstrapAdminPassword,portfolioFetchPage,youtube={},instagram={}}={}){
 mkdirSync(join(uploadRoot,'avatars'),{recursive:true});mkdirSync(join(uploadRoot,'evidence'),{recursive:true});
 if(bootstrapAdminEmail&&bootstrapAdminPassword){must(bootstrapAdminPassword.length>=12,500,'Admin password must be at least 12 characters');const email=bootstrapAdminEmail.toLowerCase().trim();if(!db.prepare('select id from users where email=?').get(email))db.prepare('insert into users(id,email,password_hash,role,name) values(?,?,?,?,?)').run(id(),email,secret(bootstrapAdminPassword),'admin','CC Circle reviewer')}
 const app=express();app.disable('x-powered-by');app.use(helmet());app.use(cors({origin:(origin,cb)=>cb(null,!origin||allowedOrigins.includes(origin))}));app.use(express.json({limit:'100kb'}));
 const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:4*1024*1024,files:1},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
 const limits=new Map();const throttle=(bucket,max,periodMs)=>(req,res,next)=>{const k=`${bucket}:${req.ip}`;const now=Date.now();const hit=limits.get(k)||{n:0,until:now+periodMs};if(now>hit.until){hit.n=0;hit.until=now+periodMs}hit.n++;limits.set(k,hit);if(hit.n>max)return res.status(429).json({error:'Too many requests. Try later.'});next()};
 const auth=(req,res,next)=>{const token=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];if(!token)return res.status(401).json({error:'Sign in required'});const row=db.prepare('select u.* from sessions s join users u on u.id=s.user_id where s.token_hash=? and s.expires_at>?').get(hash(token),new Date().toISOString());if(!row)return res.status(401).json({error:'Session expired'});req.user=row;req.token=token;next()};
 const admin=(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'Reviewer access required'});
 const ownTalent=(req,res,next)=>req.user.role==='talent'?next():res.status(403).json({error:'Talent account required'});
 const ownBuyer=(req,res,next)=>req.user.role==='buyer'?next():res.status(403).json({error:'Hiring account required'});
 const notify=(uid,body)=>db.prepare('insert into notifications(id,user_id,body) values(?,?,?)').run(id(),uid,body);
 const issueSession=user=>{const token=randomBytes(32).toString('base64url');db.prepare('insert into sessions(token_hash,user_id,expires_at) values(?,?,?)').run(hash(token),user.id,new Date(Date.now()+30*24*3600*1000).toISOString());return {token,user:publicUser(user)}};
 const allMedia=uid=>{
  const candidates=db.prepare('select pm.id,pm.kind,pm.url,pm.thumbnail,pm.source_url from portfolio_media pm join portfolios p on p.id=pm.source_id where p.user_id=? order by p.rowid desc,pm.rowid').all(uid);
  const prefs=new Map(db.prepare('select * from media_preferences where user_id=?').all(uid).map(p=>[p.media_key,p]));
  return [...new Map(candidates.filter(m=>m.kind!=='image'||isPortfolioImage(m.url)).map(m=>[m.kind+':'+(m.kind==='image'?imageIdentity(m.url):m.url),m])).values()].map((m,index)=>{const pref=prefs.get(mediaKey(m));return {...m,hidden:!!pref?.hidden,position:pref?.position??index,cover:!!pref?.cover,caption:pref?.caption||''}}).sort((a,b)=>Number(b.cover)-Number(a.cover)||a.position-b.position);
 };
 const profile=(uid,owner=false)=>{
  const u=db.prepare('select * from users where id=?').get(uid);if(!u)return null;
  const links=db.prepare('select id,url,source_type,last_checked_at,last_error from portfolios where user_id=? order by rowid').all(uid);
  const candidates=allMedia(uid).filter(m=>!m.hidden);
  const media=owner?allMedia(uid):['image','video'].flatMap(kind=>candidates.filter(m=>m.kind===kind).slice(0,10));
  const cover=candidates.find(m=>m.cover)||candidates.find(m=>m.kind==='image'||m.thumbnail);
  return {...publicUser(u),links,media,cover:cover?(cover.kind==='image'?cover.url:cover.thumbnail):null};
 };
 const scanPortfolio=async link=>{
  try{
   const found=await discoverMedia(link.url,{fetchPage:portfolioFetchPage});
   if(!db.prepare('select 1 from portfolios where id=?').get(link.id))return {images:0,videos:0};
   db.exec('BEGIN');try{
    db.prepare('delete from portfolio_media where source_id=?').run(link.id);
    const insert=db.prepare('insert into portfolio_media(id,source_id,kind,url,thumbnail,source_url,media_key) values(?,?,?,?,?,?,?)');
    for(const m of [...found.images,...found.videos])insert.run(id(),link.id,m.kind,m.url,m.thumbnail||null,publicUrl(m.source_url)||link.url,mediaKey({...m,source_url:publicUrl(m.source_url)||link.url}));
    db.prepare('update portfolios set last_checked_at=?,last_error=? where id=?').run(new Date().toISOString(),found.warning||null,link.id);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e}
   return {images:found.images.length,videos:found.videos.length,...(found.warning?{error:found.warning}:{})};
  }catch(e){
   const error=e instanceof Error?e.message:'Could not read public portfolio';
   db.prepare('update portfolios set last_checked_at=?,last_error=? where id=?').run(new Date().toISOString(),error.slice(0,180),link.id);
   return {images:0,videos:0,error};
  }
 };
 const saveConnected=(uid,sourceType,externalId,url,media)=>{
  let link=db.prepare('select id from portfolios where user_id=? and source_type=? and external_id=?').get(uid,sourceType,externalId);
  db.exec('BEGIN');try{
   if(!link)link=db.prepare('select id from portfolios where user_id=? and url=?').get(uid,url);
   if(!link){must(db.prepare('select count(*) as n from portfolios where user_id=?').get(uid).n<10,400,'Maximum 10 portfolio links');link={id:id()};db.prepare('insert into portfolios(id,user_id,url,source_type,external_id) values(?,?,?,?,?)').run(link.id,uid,url,sourceType,externalId)}
   db.prepare('delete from portfolio_media where source_id=?').run(link.id);
   const insert=db.prepare('insert or ignore into portfolio_media(id,source_id,kind,url,thumbnail,source_url,media_key) values(?,?,?,?,?,?,?)');
   for(const item of media.slice(0,160)){
    const mediaUrl=publicUrl(item.url),thumbnail=publicUrl(item.thumbnail);
    if(mediaUrl&&['image','video'].includes(item.kind))insert.run(id(),link.id,item.kind,mediaUrl,thumbnail,publicUrl(item.source_url)||(item.kind==='video'?mediaUrl:url),mediaKey({kind:item.kind,url:mediaUrl,source_url:publicUrl(item.source_url)||(item.kind==='video'?mediaUrl:url)}));
   }
   db.prepare('update portfolios set url=?,source_type=?,external_id=?,last_checked_at=?,last_error=NULL where id=?').run(url,sourceType,externalId,new Date().toISOString(),link.id);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
 };
 const deleteFile=p=>{if(p&&existsSync(join(uploadRoot,p)))unlinkSync(join(uploadRoot,p))};
 marketplaceRoutes(app,db,{auth,ownTalent,ownBuyer,must,id,notify,profile,allMedia,mediaKey,crafts,throttle});
 app.get('/health',(req,res)=>res.json({ok:true}));
 app.get('/categories',(req,res)=>res.json(crafts));
 app.get('/connections/capabilities',(req,res)=>res.json({youtube:!!(youtube.clientId&&youtube.clientSecret&&youtube.redirectUri),instagram:!!(instagram.clientId&&instagram.clientSecret&&instagram.redirectUri),behance:false}));
 app.post('/me/connect/youtube',auth,ownTalent,throttle('youtube-connect',6,3600000),(req,res,next)=>{try{
  must(youtube.clientId&&youtube.clientSecret&&youtube.redirectUri,503,'YouTube connection has not been configured');
  const state=randomBytes(24).toString('base64url');
  db.prepare('insert into oauth_states(state,user_id,provider,expires_at) values(?,?,?,?)').run(state,req.user.id,'youtube',new Date(Date.now()+10*60000).toISOString());
  res.json({url:youtubeAuthUrl({clientId:youtube.clientId,redirectUri:youtube.redirectUri,state})});
 }catch(e){next(e)}});
 app.get('/oauth/youtube/callback',async(req,res)=>{
  const state=typeof req.query.state==='string'?req.query.state:'';
  const grant=db.prepare('select * from oauth_states where state=? and provider=?').get(state,'youtube');
  if(grant)db.prepare('delete from oauth_states where state=?').run(state);
  if(!grant||grant.expires_at<new Date().toISOString()||typeof req.query.code!=='string')return res.status(400).type('html').send('<h1>Connection expired or cancelled</h1><p>Return to CC Circle and try again.</p>');
  try{
   const token=await (youtube.exchange||exchangeYouTubeCode)({code:req.query.code,clientId:youtube.clientId,clientSecret:youtube.clientSecret,redirectUri:youtube.redirectUri});
   const {channelId,videos}=await (youtube.load||loadYouTubeVideos)(token);
   must(/^[\w-]{5,80}$/.test(channelId),400,'Invalid YouTube channel');
   saveConnected(grant.user_id,'youtube',channelId,`https://www.youtube.com/channel/${channelId}`,videos);
   res.type('html').send(`<h1>YouTube connected</h1><p>${videos.length} public videos imported. Return to CC Circle and refresh your profile.</p>`);
  }catch(e){res.status(400).type('html').send('<h1>YouTube connection failed</h1><p>Return to CC Circle and try again.</p>')}
 });
 app.post('/me/connect/instagram',auth,ownTalent,throttle('instagram-connect',6,3600000),(req,res,next)=>{try{
  must(instagram.clientId&&instagram.clientSecret&&instagram.redirectUri,503,'Instagram connection has not been configured');
  const state=randomBytes(24).toString('base64url');
  db.prepare('insert into oauth_states(state,user_id,provider,expires_at) values(?,?,?,?)').run(state,req.user.id,'instagram',new Date(Date.now()+10*60000).toISOString());
  res.json({url:instagramAuthUrl({clientId:instagram.clientId,redirectUri:instagram.redirectUri,state})});
 }catch(e){next(e)}});
 app.get('/oauth/instagram/callback',async(req,res)=>{
  const state=typeof req.query.state==='string'?req.query.state:'';
  const grant=db.prepare('select * from oauth_states where state=? and provider=?').get(state,'instagram');
  if(grant)db.prepare('delete from oauth_states where state=?').run(state);
  if(!grant||grant.expires_at<new Date().toISOString()||typeof req.query.code!=='string')return res.status(400).type('html').send('<h1>Connection expired or cancelled</h1><p>Return to CC Circle and try again.</p>');
  try{
   const token=await (instagram.exchange||exchangeInstagramCode)({code:req.query.code,clientId:instagram.clientId,clientSecret:instagram.clientSecret,redirectUri:instagram.redirectUri});
   const {accountId,username,images,videos}=await (instagram.load||loadInstagramMedia)(token);
   must(/^\d{5,30}$/.test(accountId)&&/^[\w.]{1,40}$/.test(username),400,'Invalid Instagram account');
   saveConnected(grant.user_id,'instagram',accountId,`https://www.instagram.com/${username}/`,[...images,...videos]);
   res.type('html').send(`<h1>Instagram connected</h1><p>${images.length} images and ${videos.length} public videos imported. Return to CC Circle and refresh your profile.</p>`);
  }catch(e){res.status(400).type('html').send('<h1>Instagram connection failed</h1><p>Return to CC Circle and try again.</p>')}
 });
 app.post('/auth/register',throttle('register',10,3600000),(req,res,next)=>{try{const {email,password,name,role}=req.body;must(typeof email==='string'&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),400,'Valid email required');must(typeof password==='string'&&password.length>=10,400,'Password must be at least 10 characters');must(typeof name==='string'&&name.trim().length>=2&&name.length<=120,400,'Name required');must(['talent','buyer'].includes(role),400,'Choose talent or buyer');const mail=email.toLowerCase().trim();must(!db.prepare('select id from users where email=?').get(mail),409,'Email already registered');const uid=id();db.prepare('insert into users(id,email,password_hash,role,name) values(?,?,?,?,?)').run(uid,mail,secret(password),role,name.trim());res.status(201).json(issueSession(db.prepare('select * from users where id=?').get(uid)))}catch(e){next(e)}});
 app.post('/auth/login',throttle('login',20,15*60000),(req,res,next)=>{try{const {email,password}=req.body;must(typeof email==='string'&&typeof password==='string',400,'Email and password required');const u=db.prepare('select * from users where email=?').get(email.toLowerCase().trim());must(u&&validSecret(password,u.password_hash),401,'Invalid email or password');res.json(issueSession(u))}catch(e){next(e)}});
 app.post('/auth/logout',auth,(req,res)=>{db.prepare('delete from sessions where token_hash=?').run(hash(req.token));res.json({ok:true})});
 app.get('/me',auth,(req,res)=>res.json(profile(req.user.id,true)));
 app.put('/me',auth,(req,res,next)=>{try{const {name,city,category,bio,availability,role}=req.body;must(typeof name==='string'&&name.trim().length>=2&&name.length<=120,400,'Name required');must(typeof city==='string'&&city.length<=120,400,'Invalid city');must(typeof bio==='string'&&bio.length<=2000,400,'Bio too long');must(typeof availability==='string'&&availability.length<=150,400,'Invalid availability');must(crafts.includes(category)||category==='',400,'Invalid craft');must(['talent','buyer'].includes(role),400,'Invalid role');must(role===req.user.role,403,'Account type is chosen at signup and cannot be changed');const extra={day_rate:req.body.day_rate??req.user.day_rate,crafts:req.body.crafts??JSON.parse(req.user.crafts||'[]'),specialties:req.body.specialties??req.user.specialties,experience:req.body.experience??req.user.experience,rate:req.body.rate??req.user.rate,credits:req.body.credits??req.user.credits,available_from:req.body.available_from??req.user.available_from,available_until:req.body.available_until??req.user.available_until};must(Number.isInteger(extra.day_rate)&&extra.day_rate>=0&&extra.day_rate<=10000000,400,'Enter a valid daily rate');must(Array.isArray(extra.crafts)&&extra.crafts.length<=8&&extra.crafts.every(x=>crafts.includes(x)),400,'Choose up to eight valid crafts');for(const key of ['specialties','experience','rate','credits'])must(typeof extra[key]==='string'&&extra[key].length<=(key==='credits'?2000:500),400,'Invalid '+key);for(const key of ['available_from','available_until'])must(typeof extra[key]==='string'&&(!extra[key]||/^\d{4}-\d{2}-\d{2}$/.test(extra[key])&&!isNaN(Date.parse(extra[key]))&&new Date(extra[key]+'T00:00:00Z').toISOString().slice(0,10)===extra[key]),400,'Use YYYY-MM-DD dates');must(!extra.available_from||!extra.available_until||extra.available_until>=extra.available_from,400,'Availability end must follow start');db.prepare('update users set name=?,city=?,category=?,bio=?,availability=?,role=?,crafts=?,specialties=?,experience=?,rate=?,credits=?,available_from=?,available_until=?,day_rate=? where id=?').run(name.trim(),city.trim(),category,bio,availability,role,JSON.stringify(extra.crafts),extra.specialties,extra.experience,extra.rate,extra.credits,extra.available_from,extra.available_until,extra.day_rate,req.user.id);res.json(profile(req.user.id,true))}catch(e){next(e)}});
 app.post('/me/avatar',auth,upload.single('image'),(req,res,next)=>{try{must(req.file,400,'Image required');const type=imgType(req.file.buffer);must(type,400,'Invalid image');const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';const file=`avatars/${req.user.id}-${id()}.${ext}`;writeFileSync(join(uploadRoot,file),req.file.buffer,{flag:'wx'});deleteFile(req.user.avatar);db.prepare('update users set avatar=? where id=?').run(file,req.user.id);res.json({avatar:file})}catch(e){next(e)}});
 app.get('/avatars/:file',(req,res,next)=>{try{const u=db.prepare('select id from users where avatar=?').get('avatars/'+req.params.file);must(u,404,'Not found');res.sendFile(join(uploadRoot,'avatars',req.params.file))}catch(e){next(e)}});
 app.get('/talents/:id',(req,res,next)=>{try{const result=profile(req.params.id);must(result&&result.role==='talent',404,'Talent not found');res.json(result)}catch(e){next(e)}});
 app.post('/me/portfolios',auth,ownTalent,throttle('portfolio',20,3600000),async(req,res,next)=>{try{
  const url=typeof req.body.url==='string'?publicUrl(req.body.url):null;
  must(url,400,'A public HTTPS portfolio URL is required');
  must(db.prepare('select count(*) as n from portfolios where user_id=?').get(req.user.id).n<10,400,'Maximum 10 links');
  const pid=id();db.prepare('insert into portfolios(id,user_id,url) values(?,?,?)').run(pid,req.user.id,url);
  const scan=await scanPortfolio({id:pid,url});res.status(201).json({id:pid,url,...scan});
 }catch(e){next(e)}});
 app.delete('/me/portfolios/:id',auth,ownTalent,(req,res)=>{db.prepare('delete from portfolios where id=? and user_id=?').run(req.params.id,req.user.id);res.json({ok:true})});
 app.post('/me/portfolios/refresh',auth,ownTalent,throttle('portfolio-refresh',6,3600000),async(req,res,next)=>{try{
  const links=db.prepare("select id,url from portfolios where user_id=? and source_type='url' order by rowid").all(req.user.id);
  const results=[];for(const link of links)results.push({id:link.id,...await scanPortfolio(link)});
  res.json({results,media:profile(req.user.id).media});
 }catch(e){next(e)}});
 app.post('/me/verification/challenge',auth,ownTalent,(req,res,next)=>{try{must(db.prepare('select count(*) as n from portfolios where user_id=?').get(req.user.id).n>0,400,'Add a portfolio link first');const challenge=`CC-${randomBytes(5).toString('hex').toUpperCase()}`;const vid=id();db.prepare('insert into verifications(id,user_id,challenge) values(?,?,?)').run(vid,req.user.id,challenge);res.status(201).json({id:vid,challenge})}catch(e){next(e)}});
 app.get('/me/verification',auth,ownTalent,(req,res)=>res.json(db.prepare('select id,challenge,proof_url,status,reason,created_at from verifications where user_id=? order by created_at desc limit 1').get(req.user.id)||null));
 app.post('/me/verification/:id/submit',auth,ownTalent,upload.single('selfie'),(req,res,next)=>{try{const v=db.prepare('select * from verifications where id=? and user_id=?').get(req.params.id,req.user.id);must(v&&v.status==='draft',404,'Challenge not found');must(req.body.consent==='true',400,'Explicit photo review consent required');must(typeof req.body.proofUrl==='string'&&safeUrl(req.body.proofUrl),400,'Valid proof URL required');must(db.prepare('select 1 from portfolios where user_id=? and url=?').get(req.user.id,req.body.proofUrl),400,'Proof URL must be in your portfolio links');must(req.file&&imgType(req.file.buffer),400,'Live photo required');const type=imgType(req.file.buffer);const ext=type==='image/png'?'png':type==='image/webp'?'webp':'jpg';const evidence=`evidence/${v.id}.${ext}`;writeFileSync(join(uploadRoot,evidence),req.file.buffer,{flag:'wx'});db.prepare("update verifications set proof_url=?,evidence_path=?,consent_at=?,status='pending' where id=?").run(req.body.proofUrl,evidence,new Date().toISOString(),v.id);db.prepare("update users set verification='pending' where id=?").run(req.user.id);res.json({id:v.id,status:'pending'})}catch(e){next(e)}});
 app.get('/admin/verifications',auth,admin,(req,res)=>{const rows=db.prepare("select v.id,v.user_id,v.challenge,v.proof_url,v.consent_at,v.created_at,u.name,u.category,u.city from verifications v join users u on u.id=v.user_id where v.status='pending' order by v.created_at").all();res.json(rows.map(v=>({...v,links:db.prepare('select url from portfolios where user_id=?').all(v.user_id)})))});
 app.get('/admin/verifications/:id/evidence',auth,admin,(req,res,next)=>{try{const v=db.prepare('select evidence_path from verifications where id=?').get(req.params.id);must(v?.evidence_path,404,'Evidence not found');res.set('Cache-Control','private, no-store');res.sendFile(join(uploadRoot,v.evidence_path))}catch(e){next(e)}});
 app.post('/admin/verifications/:id/decision',auth,admin,(req,res,next)=>{try{const {decision,reason}=req.body;must(['approved','rejected'].includes(decision),400,'Invalid decision');must(typeof reason==='string'&&reason.trim().length>=8,400,'Review reason required');const v=db.prepare('select * from verifications where id=?').get(req.params.id);must(v&&v.status==='pending',404,'Pending submission not found');db.exec('BEGIN');try{db.prepare('update verifications set status=?,reviewer_id=?,reason=?,reviewed_at=CURRENT_TIMESTAMP where id=?').run(decision,req.user.id,reason.trim(),v.id);db.prepare('update users set verification=? where id=?').run(decision,v.user_id);db.prepare('insert into review_audit(id,verification_id,admin_id,decision,reason) values(?,?,?,?,?)').run(id(),v.id,req.user.id,decision,reason.trim());notify(v.user_id,decision==='approved'?'Profile and portfolio link checked':'Verification needs attention: '+reason.trim());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}res.json({id:v.id,status:decision})}catch(e){next(e)}});
 app.post('/me/shortlist/:id',auth,ownBuyer,(req,res,next)=>{try{must(db.prepare("select id from users where id=? and role='talent'").get(req.params.id),404,'Talent not found');db.prepare('insert or ignore into shortlists(buyer_id,talent_id) values(?,?)').run(req.user.id,req.params.id);res.json({ok:true})}catch(e){next(e)}});
 app.delete('/me/shortlist/:id',auth,ownBuyer,(req,res)=>{db.prepare('delete from shortlists where buyer_id=? and talent_id=?').run(req.user.id,req.params.id);res.json({ok:true})});
 app.post('/inquiries',auth,ownBuyer,throttle('inquiry',30,3600000),(req,res,next)=>{try{const {talentId,message}=req.body;must(typeof message==='string'&&message.trim().length>=10&&message.length<=5000,400,'Describe the project in at least 10 characters');const talent=db.prepare("select id from users where id=? and role='talent'").get(talentId);must(talent,404,'Talent not found');const iid=id();db.prepare('insert into inquiries(id,buyer_id,talent_id,message) values(?,?,?,?)').run(iid,req.user.id,talentId,message.trim());notify(talentId,`New project inquiry from ${req.user.name}`);res.status(201).json({id:iid,status:'pending'})}catch(e){next(e)}});
 app.get('/me/inquiries',auth,(req,res)=>res.json(db.prepare('select i.*,b.name as buyer_name,t.name as talent_name from inquiries i join users b on b.id=i.buyer_id join users t on t.id=i.talent_id where i.buyer_id=? or i.talent_id=? order by i.created_at desc').all(req.user.id,req.user.id)));
 app.patch('/me/inquiries/:id',auth,ownTalent,(req,res,next)=>{try{must(['accepted','declined'].includes(req.body.status),400,'Invalid response');const result=db.prepare("update inquiries set status=? where id=? and talent_id=? and status='pending' and brief_id is null").run(req.body.status,req.params.id,req.user.id);must(result.changes===1,404,'Pending inquiry not found');const i=db.prepare('select buyer_id from inquiries where id=?').get(req.params.id);notify(i.buyer_id,`${req.user.name} ${req.body.status} your inquiry`);res.json({ok:true})}catch(e){next(e)}});
 app.get('/me/notifications',auth,(req,res)=>res.json(db.prepare('select id,body,read_at,created_at from notifications where user_id=? order by created_at desc limit 100').all(req.user.id)));
 app.delete('/me',auth,(req,res,next)=>{try{must(req.user.role!=='admin',403,'Admin accounts require a separate transfer');const files=db.prepare('select avatar from users where id=?').get(req.user.id);const evidence=db.prepare('select evidence_path from verifications where user_id=?').all(req.user.id);db.exec('BEGIN');try{db.prepare('delete from notifications where user_id=?').run(req.user.id);db.prepare('delete from inquiries where buyer_id=? or talent_id=?').run(req.user.id,req.user.id);db.prepare('delete from briefs where buyer_id=?').run(req.user.id);db.prepare('delete from review_audit where verification_id in (select id from verifications where user_id=?)').run(req.user.id);db.prepare('delete from verifications where user_id=?').run(req.user.id);db.prepare('delete from users where id=?').run(req.user.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}deleteFile(files?.avatar);evidence.forEach(x=>deleteFile(x.evidence_path));res.json({ok:true})}catch(e){next(e)}});
 app.use((err,req,res,next)=>{if(err instanceof multer.MulterError)return res.status(400).json({error:err.message});if(err.code?.startsWith('SQLITE_CONSTRAINT'))return res.status(409).json({error:'This record already exists or is in use'});res.status(err.status||500).json({error:err.status?err.message:'Server error'})});
 return app;
}
