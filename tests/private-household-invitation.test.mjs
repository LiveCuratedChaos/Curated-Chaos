import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createIsolatedDevelopmentDatabase,identities as i,actor,administrator,visibleLabels} from './fixtures/isolated-development-database.mjs';

test('a fresh invitation is redeemable once by its verified recipient and rejoin starts with minimum access',async t=>{
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 const sql=name=>readFile(new URL('../supabase/drafts/'+name+'.sql',import.meta.url),'utf8');
 await db.exec(await sql('private_household_invitation'));
 async function issue(expiresAt){
  const token=randomBytes(32).toString('hex');
  await db.query("insert into cc_private.household_invitations(token_hash,household_id,issuer_id,recipient_id,expires_at) values(sha256(convert_to($1,'UTF8')),$2,$3,$4,$5)",[token,i.home,i.a,i.b,expiresAt]);
  return token;
 }
 const fresh=await issue(new Date(Date.now()+60000).toISOString());
 const expired=await issue('2000-01-01T00:00:00Z');
 await db.query("update public.cc_household_memberships set status='removed' where household_id=$1 and user_id=$2",[i.home,i.b]);
 const accept=async token=>(await db.query('select public.cc_accept_household_invitation($1) as accepted',[token])).rows[0].accepted;
 await actor(db,i.c,i.sc);
 assert.equal(await accept(fresh),false);
 await actor(db,i.b,i.sa);
 assert.equal(await accept(fresh),false);
 await actor(db,i.b,i.sb);
 assert.equal(await accept(expired),false);
 assert.equal(await accept(fresh),true);
 assert.equal(await accept(fresh),false);
 assert.deepEqual(await visibleLabels(db),['private-b']);
 await administrator(db);
 const {role,status,read_sections,write_sections}=(await db.query('select role,status,read_sections,write_sections from public.cc_household_memberships where household_id=$1 and user_id=$2',[i.home,i.b])).rows[0];
 assert.deepEqual({role,status,read_sections,write_sections},{role:'adult',status:'active',read_sections:[],write_sections:[]});
 assert.equal((await db.query('select count(*) as total from cc_private.household_invitations where accepted_at is not null')).rows[0].total,1);
 await assert.rejects(db.exec(await sql('private_household_invitation_rollback')),/while invitations are retained/);
 await db.exec('rollback');
});
