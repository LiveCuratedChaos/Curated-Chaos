// Offline PostgreSQL only. All identities/data are fictional; never loads project configuration.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
export const identities=Object.freeze({a:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',c:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',sa:'11111111-1111-4111-8111-111111111111',sb:'22222222-2222-4222-8222-222222222222',sc:'33333333-3333-4333-8333-333333333333',home:'44444444-4444-4444-8444-444444444444',other:'55555555-5555-4555-8555-555555555555'});
export async function administrator(db){await db.exec('reset role');}
export async function actor(db,sub,session_id){await administrator(db);await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub,...(session_id?{session_id}:{})})]);await db.exec('set role authenticated');}
export async function createIsolatedDevelopmentDatabase(){
 const db=await PGlite.create();
 try{await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to anon,authenticated;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id));create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
 const directory=new URL('../../supabase/migrations/',import.meta.url),files=(await readdir(directory)).filter(name=>/^\d+.*\.sql$/.test(name)).sort();for(const file of files)await db.exec(await readFile(new URL(file,directory),'utf8'));
 const i=identities;for(const [user,session]of [[i.a,i.sa],[i.b,i.sb],[i.c,i.sc]]){await db.query('insert into auth.users values($1)',[user]);await db.query('insert into auth.sessions values($1,$2)',[session,user]);await db.query("insert into public.cc_profiles(user_id,display_name) values($1,'Fictional account')",[user]);}
 await db.query("insert into public.cc_households(id,owner_id,name) values($1,$2,'Fictional home'),($3,$4,'Fictional other home')",[i.home,i.a,i.other,i.c]);await db.query("insert into public.cc_household_memberships(household_id,user_id,role,read_sections,write_sections) values($1,$2,'adult',array['Home'],array['School'])",[i.home,i.b]);
 for(const [label,owner,home,section]of [['private-a',i.a,null,'Home'],['private-b',i.b,null,'Home'],['shared-home',i.a,i.home,'Home'],['shared-school',i.a,i.home,'School'],['shared-finance',i.a,i.home,'Finances'],['shared-by-b',i.b,i.home,'Home'],['other-home',i.c,i.other,'Home']])await db.query("insert into public.cc_records(owner_id,household_id,visibility,section,item_type,payload,created_at,updated_at,version) values($1,$2,$3,$4,'note',$5,'2026-01-01T12:00:00Z','2026-01-02T12:00:00Z',7)",[owner,home,home?'household':'private',section,JSON.stringify({fictional:true,label,body:'Fictional preserved text\n<literal>'})]);
 return db;
 }catch(error){await db.close();throw error;}
}
export async function visibleLabels(db){return(await db.query("select payload->>'label' as label from public.cc_records order by label")).rows.map(row=>row.label);}
