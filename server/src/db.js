import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export const crafts=['Acting','Direction','Camera','Lighting','Art & sets','Costume','Makeup','Stunts','Editing','Sound','Music','Voice','VFX','Animation','Color','Subtitles','Production','Writing','Casting','Locations','Photography','Choreography','Publicity','Props'];
export const mediaKey=m=>`${m.kind}:${m.source_url||''}:${new URL(m.url).pathname}`;
export function createDb(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 db.exec(`
 CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('talent','buyer','admin')),
  name TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '', avatar TEXT, availability TEXT NOT NULL DEFAULT '',
  verification TEXT NOT NULL DEFAULT 'unverified' CHECK(verification IN ('unverified','pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL, source_type TEXT NOT NULL DEFAULT 'url', external_id TEXT,
  last_checked_at TEXT, last_error TEXT, UNIQUE(user_id,url)
 );
 CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, expires_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS portfolio_media (
  id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('image','video')), url TEXT NOT NULL, thumbnail TEXT, source_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_id,kind,url)
 );
 CREATE TABLE IF NOT EXISTS media_links (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('image','video')), url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,kind,url)
 );
 CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL, proof_url TEXT, evidence_path TEXT,
  consent_at TEXT, status TEXT NOT NULL DEFAULT 'draft'
   CHECK(status IN ('draft','pending','approved','rejected')),
  reviewer_id TEXT REFERENCES users(id), reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TEXT
 );
 CREATE TABLE IF NOT EXISTS review_audit (
  id TEXT PRIMARY KEY, verification_id TEXT NOT NULL REFERENCES verifications(id),
  admin_id TEXT NOT NULL REFERENCES users(id), decision TEXT NOT NULL,
  reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS shortlists (
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  talent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(buyer_id,talent_id)
 );
 CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id),
  talent_id TEXT NOT NULL REFERENCES users(id), message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, category TEXT NOT NULL, city TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
 );
 CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
 CREATE INDEX IF NOT EXISTS idx_users_discovery ON users(role,category,city);
 CREATE INDEX IF NOT EXISTS idx_portfolio_media_source ON portfolio_media(source_id,kind);
 CREATE INDEX IF NOT EXISTS idx_inquiries_buyer ON inquiries(buyer_id,created_at);
 CREATE INDEX IF NOT EXISTS idx_inquiries_talent ON inquiries(talent_id,created_at);
 CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,created_at);
 `);
 const columns=db.prepare('PRAGMA table_info(portfolios)').all().map(x=>x.name);
 if(!columns.includes('last_checked_at'))db.exec('ALTER TABLE portfolios ADD COLUMN last_checked_at TEXT');
 if(!columns.includes('last_error'))db.exec('ALTER TABLE portfolios ADD COLUMN last_error TEXT');
 if(!columns.includes('source_type'))db.exec("ALTER TABLE portfolios ADD COLUMN source_type TEXT NOT NULL DEFAULT 'url'");
 if(!columns.includes('external_id'))db.exec('ALTER TABLE portfolios ADD COLUMN external_id TEXT');
 if(!db.prepare('PRAGMA table_info(portfolio_media)').all().some(column=>column.name==='source_url'))db.exec('ALTER TABLE portfolio_media ADD COLUMN source_url TEXT');
 if(!db.prepare('PRAGMA table_info(portfolio_media)').all().some(x=>x.name==='media_key'))db.exec("ALTER TABLE portfolio_media ADD COLUMN media_key TEXT NOT NULL DEFAULT ''");
 const keyUpdate=db.prepare('update portfolio_media set media_key=? where id=?');for(const m of db.prepare("select * from portfolio_media where media_key=''").all())keyUpdate.run(mediaKey(m),m.id);
 const addColumns=(table,fields)=>{const existing=db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name);for(const [name,type] of Object.entries(fields))if(!existing.includes(name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`)};
 addColumns('users',{day_rate:'INTEGER NOT NULL DEFAULT 0',crafts:"TEXT NOT NULL DEFAULT '[]'",specialties:"TEXT NOT NULL DEFAULT ''",experience:"TEXT NOT NULL DEFAULT ''",rate:"TEXT NOT NULL DEFAULT ''",credits:"TEXT NOT NULL DEFAULT ''",available_from:"TEXT NOT NULL DEFAULT ''",available_until:"TEXT NOT NULL DEFAULT ''"});
 addColumns('briefs',{crafts:"TEXT NOT NULL DEFAULT '[]'",budget:"TEXT NOT NULL DEFAULT ''",dates:"TEXT NOT NULL DEFAULT ''",deliverables:"TEXT NOT NULL DEFAULT ''",deadline:"TEXT NOT NULL DEFAULT ''"});
 addColumns('inquiries',{brief_id:'TEXT REFERENCES briefs(id) ON DELETE SET NULL',confirmed_at:'TEXT'});
 db.exec(`
 CREATE TABLE IF NOT EXISTS media_preferences(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,media_key TEXT NOT NULL,hidden INTEGER NOT NULL DEFAULT 0,position INTEGER NOT NULL DEFAULT 0,cover INTEGER NOT NULL DEFAULT 0,caption TEXT NOT NULL DEFAULT '',PRIMARY KEY(user_id,media_key));
 CREATE TABLE IF NOT EXISTS inquiry_messages(id TEXT PRIMARY KEY,inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS applications(id TEXT PRIMARY KEY,brief_id TEXT NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,talent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(brief_id,talent_id));
 CREATE TABLE IF NOT EXISTS shortlist_projects(id TEXT PRIMARY KEY,buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,share_token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS project_talent(project_id TEXT NOT NULL REFERENCES shortlist_projects(id) ON DELETE CASCADE,talent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(project_id,talent_id));
 CREATE TABLE IF NOT EXISTS follows(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,talent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(user_id,talent_id));
 CREATE TABLE IF NOT EXISTS community_posts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS community_likes(post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(post_id,user_id));
 CREATE TABLE IF NOT EXISTS community_comments(id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS saved_searches(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,filters TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
 `);
 return db;
}
