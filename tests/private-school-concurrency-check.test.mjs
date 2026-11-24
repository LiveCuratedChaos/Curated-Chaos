// Single embedded connection validates QA setup, race outcomes and cleanup; not a concurrency claim.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {privateSchoolConcurrencyCheck} from '../server/private-school-concurrency-check.mjs';import {createIsolatedDevelopmentDatabase,administrator} from './fixtures/isolated-development-database.mjs';
test('isolated School concurrency QA uses bounded fresh fixtures, refuses stale link and removes only its fixture footprint',async t=>{
 const q=privateSchoolConcurrencyCheck(),db=await createIsolatedDevelopmentDatabase();t.after(()=>db.close());for(const file of ['private_school_records.sql','private_school_records_ready.sql'])await db.exec(await readFile(new URL('../supabase/drafts/'+file,import.meta.url),'utf8'));
 const before=(await db.query('select * from public.cc_records order by id')).rows,sessions=(await db.query('select * from auth.sessions order by id')).rows;
 await db.exec(q.setupSql);await assert.rejects(db.exec(q.setupSql),/collision/);await db.exec('rollback');
 // Emulate the committed winner without waiting; real multiple-connection acceptance is separate.
 await db.exec(q.holdDeletionSql.replace('perform pg_sleep(12);',''));await db.exec(q.rejectedLinkSql);await administrator(db);await db.exec(q.cleanupSql);
 assert.deepEqual((await db.query('select * from public.cc_records order by id')).rows,before);assert.deepEqual((await db.query('select * from auth.sessions order by id')).rows,sessions);assert.notEqual(q.sessionId,privateSchoolConcurrencyCheck().sessionId);assert.match(q.holdDeletionSql,/lock_timeout='15s'/);assert.match(q.probeSql,/advisory/);assert.match(q.waitingProbeSql,/not waiting.granted/);assert.match(q.waitingProbeSql,/h.pid<>w.pid/);assert.notEqual(q.applicationName,q.contenderName);
});
