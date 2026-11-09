import {createSealedFinanceRepository} from '../server/sealed-finance-repository.mjs';
import {createLocalProviderStore} from '../server/local-provider-store.mjs';
import {join} from 'node:path';
// Financial database writes require a distinct, exact owner-approved run. Offline by default.
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadLocalConfig,assertDevTarget} from './dev-env.mjs';
import {createDevApi} from '../src/dev-api.mjs';
import {loadPlaidProductionConfig} from '../server/plaid-sandbox-config.mjs';
import {createPlaidChaseRead} from '../server/plaid-chase-read.mjs';
import {loadChasePreviewGrant,createChasePreview} from '../server/chase-preview.mjs';
import {planChaseImport} from '../server/chase-import-plan.mjs';
import {createProviderImportExecutor} from '../server/provider-import-executor.mjs';
import {createDevProviderRepository} from '../server/dev-provider-repository.mjs';
import {validateChasePreviewArguments} from './chase-preview-server.mjs';
export function validateChaseImportArguments(argv){
 if(!argv.includes('--allow-financial-import'))return null;
 const approved=validateChasePreviewArguments([...argv,'--allow-financial-preview']),maxTransactions=Number(argv.find(a=>a.startsWith('--max-transactions='))?.slice('--max-transactions='.length));
 if(!Number.isInteger(maxTransactions)||maxTransactions<0||maxTransactions+approved.expectedAccountCount>250)throw Error('An exact financial transaction import cap is required.');return {...approved,maxTransactions};
}
async function run(root,approved){
 const config=assertDevTarget(loadLocalConfig());if(config.ref!==approved.project)throw Error('Unexpected development database.');
 const publicConfig={supabaseUrl:config.url,projectRef:config.ref,publishableKey:config.publishableKey},api=createDevApi(publicConfig),signed=await api.signIn(config.users[0].email,config.users[0].password),user=await api.getUser(signed.accessToken);
 if(!user?.id)throw Error('Verified financial owner required.');
 const ownerId=user.id,binding=randomBytes(32).toString('base64url'),actor={ownerId,accessToken:signed.accessToken,sessionBinding:binding},confirmSession=async owner=>(await api.getUser(signed.accessToken))?.id===owner;
 const adapter=createPlaidChaseRead({...await loadPlaidProductionConfig(root,{approved:true}),productionApproved:true}),loadGrant=owner=>loadChasePreviewGrant(root,owner),preview=await createChasePreview({loadGrant,confirmSession,adapter})({ownerId,binding,confirmed:true,...approved});
 if(preview.accounts.length!==approved.expectedAccountCount||preview.transactions.length>approved.maxTransactions)throw Error('Financial preview exceeds the approved record scope.');
 const trusted=await loadGrant(ownerId),selectedKeys=[...preview.accounts,...preview.transactions].map(row=>row.key),allowedKeys=new Set(selectedKeys),{sealer}=await createLocalProviderStore(join(root,'.local/provider-storage')),repository=createSealedFinanceRepository(createDevProviderRepository(publicConfig,{expectedProjectRef:approved.project}),sealer);
 const executor=createProviderImportExecutor({repository,planImport:planChaseImport,resolveActor:async candidate=>await confirmSession(candidate.ownerId)?{ownerId:candidate.ownerId,sessionBinding:candidate.sessionBinding}:null,
  validateSourceSelection:async(_actor,session,args)=>{const current=await loadGrant(session.ownerId);if(session.ownerId!==ownerId||args.connectionId!==trusted.connectionId||current.connectionId!==trusted.connectionId||current.accessToken!==trusted.accessToken||JSON.stringify(current.accountIds)!==JSON.stringify(trusted.accountIds)||args.selectionId!==preview.selectionId)throw Error('Financial source changed.');},
  authorizeWrite:async(_actor,args)=>!args.fixtureRunId&&args.selectionId===preview.selectionId&&args.selectedKeys.length<=approved.expectedAccountCount+approved.maxTransactions&&args.selectedKeys.every(k=>allowedKeys.has(k))});
 const args={connectionId:preview.connectionId,selectionId:preview.selectionId,preview,selectedKeys,previewExpiresAt:Date.now()+300000},review=await executor.prepare(actor,args);
 if(review.conflictCount)throw Error('Changed saved financial records need separate review.');
 const receipt=await executor.execute(actor,{reviewId:review.reviewId,approved:true});
 console.log(JSON.stringify({verified:true,institution:'Chase',accountSnapshots:preview.accounts.length,transactionSnapshots:preview.transactions.length,inserted:receipt.inserted,alreadySaved:receipt.unchanged,startDate:approved.startDate,endDateExclusive:approved.endDateExclusive,verifiedAt:receipt.verifiedAt}));
 console.log('Approved owner-private financial snapshots saved and reread. No amounts, names, credentials, account IDs or transaction details printed. No bank changes, bill payments, transfers, trades, schema changes or deployment.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const approved=validateChaseImportArguments(process.argv.slice(2));if(approved)await run(process.cwd(),approved);else{console.log('PLAN ONLY — no credentials read, no network requests, no database writes.');console.log('Requires separate explicit financial-storage approval plus --allow-financial-import --project=EXACT_DEV_PROJECT --accounts=APPROVED_COUNT --max-transactions=APPROVED_CAP --start=YYYY-MM-DD --end=YYYY-MM-DD.');console.log('Uses the existing Chase grant, verifies the exact account/window/cap, compares existing private records and inserts only new approved snapshots. Changed records stop for review; there is no upsert, update or delete. No banking action or production deployment.');}}
 catch{console.error('Financial import STOPPED. No financial details or credentials are printed. Check existing saved records before retrying an uncertain outcome.');process.exitCode=1;}
}
