import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createIsolatedDevelopmentDatabase,identities as i,actor,administrator,visibleLabels} from './fixtures/isolated-development-database.mjs';

test('only the current primary guardian with a verified session passes the roster check',async t=>{
 const db=await createIsolatedDevelopmentDatabase();
 t.after(()=>db.close());
 const sql=name=>readFile(new URL('../supabase/drafts/'+name+'.sql',import.meta.url),'utf8');
 await db.exec(await sql('private_primary_guardian'));
 const child=randomUUID();
 await db.query('insert into cc_private.child_guardian_profiles(id,primary_guardian_id) values($1,$2)',[child,i.b]);
 await db.query('insert into cc_private.designated_guardians values($1,$2)',[child,i.c]);
 const allowed=async id=>(await db.query('select cc_private.can_manage_child_guardians($1) as allowed',[id])).rows[0].allowed;
 for(const [user,session,expected]of [[i.a,i.sa,false],[i.c,i.sc,false],[i.b,i.sa,false],[i.b,i.sb,true]]){
  await actor(db,user,session);
  assert.equal(await allowed(child),expected);
  assert.equal(await allowed(randomUUID()),false);
 }
 assert.ok(!(await visibleLabels(db)).includes('private-a'));
 await assert.rejects(db.query('update cc_private.child_guardian_profiles set primary_guardian_id=$1 where id=$2',[i.a,child]),/permission denied/);
 await administrator(db);
 await db.query('update cc_private.child_guardian_profiles set independent_adult_at=now() where id=$1',[child]);
 await actor(db,i.b,i.sb);
 assert.equal(await allowed(child),false);
 await administrator(db);
 await assert.rejects(db.exec(await sql('private_primary_guardian_rollback')),/while profiles are retained/);
 await db.exec('rollback');
 assert.equal((await db.query('select count(*) as total from cc_private.designated_guardians')).rows[0].total,1);
});
