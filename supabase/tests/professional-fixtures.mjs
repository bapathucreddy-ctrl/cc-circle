/** Complete registration requirements for older booking/security fixtures.
 * Validation-specific tests construct their own inputs instead of using this helper.
 */
export async function saveTestProfile(db,sql,args){
 const [profile,privateData,service]=args;const state=(await db.query('select current_user as role,auth.uid() as id')).rows[0];
 await db.exec('reset role');try{await db.query("update public.profiles set full_name='Mira Rao' where id=$1 and not private.valid_identity_name(full_name)",[state.id]);}finally{await db.exec('set role '+state.role);}
 const photo={'lenses':'24-70mm f2.8','lighting-kit':'Two LED kits','backup-camera':'Canon R6','backup-memory':'Two 128GB cards','equipment-pricing':'Included','photo-software':['Adobe Lightroom']};
 const software=profile.category==='Photographer'?photo:profile.category==='ContentCreator'?{'video-software':['Adobe Premiere Pro']}:profile.category==='Editor'?{'editing-services':['Video Editing'],'video-software':['Adobe Premiere Pro']}:{};
 return db.query(sql,[{...profile,public_specs:{...software,...profile.public_specs}},{home_location:{address:'Fixture home, Test street, Bengaluru',longitude:profile.longitude,latitude:profile.latitude},...privateData},service]);
}
export async function grantTestAdmin(db,id){
 await db.exec('alter table auth.users add column if not exists email text;alter table auth.users add column if not exists email_confirmed_at timestamptz;');
 const email=id+'@admin.example.test';await db.query('update auth.users set email=$2,email_confirmed_at=now() where id=$1',[id,email]);await db.query('select public.grant_banner_admin($1)',[email]);
}
export async function approveTestTeam(db,sql,args){
 const expected=args[1]??Number(sql.match(/,(\d+)\)/)?.[1]);
 const result=await db.query('select public.review_bulk_response($1,true,\'\',$2) as id',[args[0],expected]);
 return db.query('select * from public.bookings where id=$1',[result.rows[0].id]);
}
