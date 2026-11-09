import {stableStringify} from '../server/stable-json.mjs';
// PLAN ONLY unless the owner explicitly approves the exact development write run.
import {randomUUID} from 'node:crypto';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {createDevProviderRepository} from '../server/dev-provider-repository.mjs';
import {createProviderImportExecutor} from '../server/provider-import-executor.mjs';
import {planGoogleSourceImport} from '../server/google-import-plan.mjs';
import {normalizeGmailMetadata} from '../server/gmail.mjs';
import {normalizeGoogleEvent} from '../server/google-calendar.mjs';
async function run(expectedProjectRef){
 const config=assertDevTarget(loadLocalConfig());if(config.ref!==expectedProjectRef)throw Error('Unexpected development project.');
 const publicConfig={supabaseUrl:config.url,projectRef:config.ref,publishableKey:config.publishableKey},api=createDevApi(publicConfig);
 let checks=0,writes=0;const pass=(label,condition)=>{if(!condition)throw Error('Development verification failed.');console.log('PASS '+(++checks)+': '+label);};
 const actors=[];for(const user of config.users){const session=await api.signIn(user.email,user.password),profile=await api.getUser(session.accessToken);if(!profile?.id)throw Error('Test sign-in failed.');actors.push({accessToken:session.accessToken,ownerId:profile.id,sessionBinding:randomUUID()});}
 const [a,b]=actors;pass('Two distinct fictional test accounts authenticated',a.ownerId!==b.ownerId);
 const repository=createDevProviderRepository(publicConfig,{expectedProjectRef});
 const executor=createProviderImportExecutor({authorizeWrite:async(_actor,args)=>args.fixtureRunId===fixtureRunId,repository:{...repository,insertMany:async(...args)=>{writes++;return repository.insertMany(...args);}},resolveActor:async actor=>{const profile=await api.getUser(actor.accessToken);return profile?.id===actor.ownerId?{ownerId:profile.id,sessionBinding:actor.sessionBinding}:null;}});
 const fixtureRunId=randomUUID(),connectionId=randomUUID(),selectionId=randomUUID(),calendarConnectionId=randomUUID(),calendarSelectionId=randomUUID();
 const messages=[1,2].map(i=>normalizeGmailMetadata({id:'qa_'+fixtureRunId+'_'+i,threadId:'qa_thread_'+i,internalDate:String(Date.parse('2026-11-03T12:00:00Z')),labelIds:['INBOX'],payload:{headers:[{name:'Subject',value:'QA FICTIONAL import '+fixtureRunId.slice(0,8)+' '+i},{name:'From',value:'fictional@example.test'}]}},{ownerId:a.ownerId,connectionId}));
 const gmail={connectionId,selectionId,fixtureRunId,selectedKeys:messages.map(m=>m.key),preview:{previewOnly:true,persisted:false,selectionId,result:{provider:'gmail',ownerId:a.ownerId,connectionId,content:'metadata-only',complete:true,messages}}};
 const event=normalizeGoogleEvent({id:'qa_'+fixtureRunId,status:'confirmed',summary:'QA FICTIONAL all-day '+fixtureRunId.slice(0,8),start:{date:'2026-11-10'},end:{date:'2026-11-12'}},{ownerId:a.ownerId,calendarId:'primary'});
 const calendar={connectionId:calendarConnectionId,selectionId:calendarSelectionId,fixtureRunId,selectedKeys:[event.key],preview:{previewOnly:true,persisted:false,selectionId:calendarSelectionId,result:{provider:'google_calendar',ownerId:a.ownerId,calendarId:'primary',complete:true,events:[event]}}};
 const emailReview=await executor.prepare(a,gmail);pass('Email review proposes exactly two fictional private records',emailReview.insertCount===2&&emailReview.conflictCount===0&&writes===0);
 const mailSaved=await executor.execute(a,{reviewId:emailReview.reviewId,approved:true});pass('Email batch is saved and reread exactly',mailSaved.inserted===2&&writes===1);
 const repeat=await executor.prepare(a,gmail);pass('Repeat review recognizes both messages without duplicates',repeat.insertCount===0&&repeat.unchangedCount===2);
 const noOp=await executor.execute(a,{reviewId:repeat.reviewId,approved:true});pass('Repeat execution performs no database insert',noOp.inserted===0&&writes===1);
 const calendarReview=await executor.prepare(a,calendar),eventSaved=await executor.execute(a,{reviewId:calendarReview.reviewId,approved:true});pass('One fictional all-day calendar record is saved and verified',eventSaved.inserted===1&&writes===2);
 const expected=[...planGoogleSourceImport({...gmail,ownerId:a.ownerId}).actions,...planGoogleSourceImport({...calendar,ownerId:a.ownerId}).actions].map(x=>x.record);
 const ids=expected.map(r=>r.id),rows=await repository.readByIds(a,a.ownerId,ids);
 pass('Exactly three labeled owner-private fictional provider records exist',rows.length===3&&rows.every(r=>r.visibility==='private'&&r.household_id===null&&r.payload.fictional===true&&r.payload.fixtureRunId===fixtureRunId&&r.origin==='google_import_qa'));
 pass('All-day exclusive end remains intact',rows.find(r=>r.item_type==='provider_event')?.payload.content.endDateExclusive==='2026-11-12');
 const hidden=await repository.readByIds(b,b.ownerId,ids);pass('Account B cannot read Account A provider records',hidden.length===0);
 // A deny-test can affect only this run's newly created fictional record if RLS is broken.
 const response=await fetch(config.url+'/rest/v1/cc_records?id=eq.'+ids[0],{method:'PATCH',headers:{apikey:config.publishableKey,Authorization:'Bearer '+b.accessToken,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({payload:{fictional:true,fixtureRunId,label:'QA unauthorized update must fail'}}),redirect:'error',signal:AbortSignal.timeout(15000)});
 let denied;try{denied=await response.json();}catch{denied=null;}
 pass('Account B cannot modify Account A provider record',response.status===403||(response.ok&&Array.isArray(denied)&&denied.length===0));
 const intact=await repository.readByIds(a,a.ownerId,ids);pass('Failed cross-account update left all fixture contents intact',expected.every(e=>intact.some(r=>r.id===e.id&&stableStringify(r.payload.content)===stableStringify(e.payload.content))));
 console.log(checks+' provider-import development checks passed. Fictional audit run: '+fixtureRunId);
 console.log('Three labeled fictional records remain in DEVELOPMENT. No schema changes, real Google requests, real-content imports, deletes or deployment.');
}
const allowed=process.argv.includes('--allow-dev-writes')&&process.argv.includes('--fixtures-only');
const expected=process.argv.find(a=>a.startsWith('--project='))?.slice(10);
if(allowed&&expected){run(expected).catch(()=>{console.error('Provider import verification STOPPED. Check the development test setup. Credentials and record contents are not printed. Fixtures may remain; inspect before retrying.');process.exitCode=1;});}
else{
 console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');
 console.log('After explicit owner approval: --allow-dev-writes --fixtures-only --project=EXPECTED_DEV_PROJECT');
 console.log('Authenticates two existing fictional development accounts; inserts three labeled private fictional provider records (two mail, one calendar); verifies exact rereads, duplicate-free retries and cross-account isolation.');
 console.log('A negative test attempts an unauthorized update to a newly created fixture only. Fixtures remain for audit. No schema change, Google access, real personal content, deletion or deployment.');
}
