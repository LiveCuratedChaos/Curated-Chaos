import {validateFavoriteItems,validateFavoriteMemberships,favoriteCollections} from './private-favorite-items.mjs';
import {validateFavoritePages} from '../src/private-favorites.mjs';
import {normalizeBriefPreferences} from '../src/dev-preferences-model.mjs';
import {validateBriefLayout} from '../src/private-brief-layout.mjs';
import {validateCalendarPresentation} from '../src/private-calendar-presentation.mjs';
import {validateOnboarding} from '../src/private-onboarding.mjs';
import {validateQuickAddLayout} from '../src/private-quick-add-layout.mjs';
import {analyzeRoutineSeries} from './private-routine-streak.mjs';
import {validateTaskRecurrence,nextTaskOccurrence} from '../src/task-recurrence.mjs';
import {holdingType} from './private-holding-record.mjs';
import {reconciliationType,validateExpenseReconciliation} from './private-expense-reconciliation.mjs';
import {categorySource,categoryRecordType} from './private-transaction-category-record.mjs';
import {billMatchCandidate} from './private-manual-bill-review.mjs';
import {billType,confirmationType} from './private-bill-records.mjs';
import {incomeSourceType,incomePaymentType} from './private-income-records.mjs';
import {decodeManualFinanceRow} from './private-manual-finance-storage.mjs';
import {createTokenSealer} from './token-sealer.mjs';
import {normalizeHomeGrocery} from '../src/private-home-grocery.mjs';import {normalizeHomeDelivery} from '../src/private-home-delivery.mjs';
import {withinPrivateRecoveryWindow} from '../src/private-record-retention.mjs';
import {safeSavedAt} from './snapshot-freshness.mjs';
import {privateAllDayEvent} from './private-event-all-day.mjs';
import {privateEventRange} from './private-event-range.mjs';
import {privateEventDetails} from './private-event-details.mjs';
import {supportsPrivateSchoolRestore} from './private-school-restore.mjs';
// Conservative ordinary-record restore scope; additional record types stay blocked.
import {privateSavedSearchState} from './private-saved-searches.mjs';
import {privateProjectState} from './private-projects.mjs';
import {privateWidgetLayoutRecord} from './private-widget-layout-record.mjs';
import {privateListTemplateState} from '../src/private-list-template-model.mjs';
import {normalizeHomeCleaning} from '../src/private-home-cleaning.mjs';
import {validDay,TASK_SECTIONS,normalizeCloudRecords} from '../src/dev-brief-model.mjs';
import {TASK_PRIORITIES} from '../src/task-priorities.mjs';
import {stableStringify} from './stable-json.mjs';
import {createHash} from 'node:crypto';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const keys=(p,allowed)=>Object.keys(p).every(k=>allowed.includes(k));
const title=v=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=140&&!/[\u0000-\u001f\u007f]/.test(v);
export function blockedManualFinanceRestores(inserts,existing,key,verifiedDocuments=new Set()){
 const financeTypes=['manual_finance_account',incomeSourceType,billType,holdingType];
 const all=[...existing,...inserts].filter(row=>row.deleted_at===null);
 const insertedManual=inserts.filter(row=>financeTypes.includes(row.item_type)||['manual_finance_budget',confirmationType,incomePaymentType,categoryRecordType,reconciliationType].includes(row.item_type));
 if(!insertedManual.length)return 0;
 const overCapacity=financeTypes.filter(type=>all.filter(r=>r.item_type===type&&r.section==='Finances'&&r.origin==='PRIVATE_MANUAL_FINANCE').length>100);
 const byId=new Map(all.map(row=>[row.id,row])),sealer=createTokenSealer(key);
 return insertedManual.filter(row=>{
  if(overCapacity.includes(row.item_type))return true;
  if(row.item_type==='manual_finance_budget'){
   try{
    const budget=decodeManualFinanceRow(row,row.owner_id,sealer).payload.budget;
    if(budget.transactions.some(e=>e.receiptFile&&!verifiedDocuments.has(e.receiptFile.documentId)))return true;
    const links=budget.transactions.filter(e=>e.reconciliationId);
    if(new Set(links.map(e=>e.reconciliationId)).size!==links.length)return true;
    return links.some(e=>{
     const receipt=decodeManualFinanceRow(byId.get(e.reconciliationId),row.owner_id,sealer);
     return receipt.item_type!==reconciliationType||receipt.payload.budgetId!==row.id||
      receipt.payload.expense.amountMinor!==e.amountMinor||receipt.payload.expense.day!==e.day;
    });
   }catch{return true;}
  }
  if(row.item_type===reconciliationType){
   try{
    const receipt=decodeManualFinanceRow(row,row.owner_id,sealer),{budgetId,source}=receipt.payload;
    const matched=validateExpenseReconciliation(receipt,row.owner_id);
    const budget=decodeManualFinanceRow(byId.get(budgetId),row.owner_id,sealer);
    const expenses=budget.payload.budget.transactions.filter(e=>e.reconciliationId===row.id);
    const original=byId.get(source.recordId);
    if(expenses.length!==1||expenses[0].day!==matched.expense.day||expenses[0].amountMinor!==matched.expense.amountMinor||
       original?.version!==source.version||original.payload?.scheme!=='chase-private-v1'||original.payload.version!==1)return true;
    const snapshot={...original,payload:sealer.unseal(original.payload.encrypted,'finance-record:'+row.owner_id+':'+source.recordId)};
    const entry=categorySource(snapshot,row.owner_id);
    return entry.pending||stableStringify(entry.source)!==stableStringify(source);
   }catch{return true;}
  }
  if(row.item_type===categoryRecordType){
   try{
    const {source,receiptDocumentId}=decodeManualFinanceRow(row,row.owner_id,sealer).payload;
    if(receiptDocumentId&&!verifiedDocuments.has(receiptDocumentId))return true;
    const original=byId.get(source.recordId);
    if(original?.version!==source.version||original.payload?.scheme!=='chase-private-v1'||original.payload.version!==1)return true;
    const snapshot={...original,payload:sealer.unseal(original.payload.encrypted,'finance-record:'+row.owner_id+':'+source.recordId)};
    const entry=categorySource(snapshot,row.owner_id);
    return entry.pending||stableStringify(entry.source)!==stableStringify(source);
   }catch{return true;}
  }
  if(row.item_type===confirmationType){
   try{
    const receipt=decodeManualFinanceRow(row,row.owner_id,sealer).payload;
    const parent=byId.get(receipt.billId);
    if(parent?.item_type!==billType||!decodeManualFinanceRow(parent,row.owner_id,sealer))return true;
    if(!receipt.match)return false;
    if(all.some(r=>r.id!==row.id&&r.owner_id===row.owner_id&&r.item_type===confirmationType&&r.payload?.matchKey===receipt.match.key))return true;
    const source=byId.get(receipt.match.recordId);
    if(source?.version!==receipt.match.version||source.payload?.scheme!=='chase-private-v1'||source.payload.version!==1)return true;
    const snapshot={...source,payload:sealer.unseal(source.payload.encrypted,'finance-record:'+row.owner_id+':'+source.id)};
    const candidate=billMatchCandidate(snapshot,row.owner_id,receipt.confirmation.paidDay);
    return !candidate||candidate.match.key!==receipt.match.key||candidate.summary.paidDay!==receipt.confirmation.paidDay||
     candidate.summary.amountMinor!==receipt.confirmation.amountMinor;
   }catch{return true;}
  }
  if(row.item_type!==incomePaymentType)return false;
  try{
   const payment=decodeManualFinanceRow(row,row.owner_id,sealer);
   const source=byId.get(payment.payload.sourceId);
   return source?.item_type!==incomeSourceType||!decodeManualFinanceRow(source,row.owner_id,sealer);
  }catch{return true;}
 }).length;
}

const presentationFields=new Map([
 ['briefLayout',validateBriefLayout],['calendarPresentation',validateCalendarPresentation],
 ['favoriteItems',validateFavoriteItems],['favorites',validateFavoritePages],['onboarding',validateOnboarding],['quickAddLayout',validateQuickAddLayout]
]);

// An older client can omit settings added later. Check each supplied value before
// accepting the original bytes. The restore transaction inserts the unmodified row.
function matchesSavedSetting(saved,normalized){
 if(saved===null||typeof saved!=='object'||Array.isArray(saved))return stableStringify(saved)===stableStringify(normalized);
 if(!normalized||typeof normalized!=='object'||Array.isArray(normalized))return false;
 return Object.entries(saved).every(([key,value])=>Object.hasOwn(normalized,key)&&matchesSavedSetting(value,normalized[key]));
}

function supportsPrivatePreferences(row){
 const {fictional,source,...fields}=row.payload;
 if(row.section!=='Personal Life'||row.origin!=='M1F_QA_SETTINGS'||source!==row.origin||fictional!==true)return false;
 if(fields.favoriteItems)validateFavoriteMemberships(validateFavoriteItems(fields.favoriteItems),favoriteCollections(fields));
 const normalized=normalizeBriefPreferences(fields);
 for(const [name,value] of Object.entries(fields)){
  if(presentationFields.has(name))presentationFields.get(name)(value);
  else if(!Object.hasOwn(normalized,name)||!matchesSavedSetting(value,normalized[name]))return false;
 }
 return true;
}

export function supportsOrdinaryWorkspaceRestore(row,{manualFinanceKey=null}={}){
 try{
  if(['manual_finance_account','manual_finance_budget',incomeSourceType,incomePaymentType,billType,confirmationType,categoryRecordType,reconciliationType,holdingType].includes(row.item_type) && manualFinanceKey && row.deleted_at===null){
   decodeManualFinanceRow(row,row.owner_id,createTokenSealer(manualFinanceKey));
   return true;
  }
  const p=row.payload;if(row.deleted_at!==null||p.fictional!==true)return false;
  if(row.item_type==='brief_preferences')return supportsPrivatePreferences(row);
  if(row.item_type==='dashboard_layout'){privateWidgetLayoutRecord(row,row.owner_id);return true;}
  if(row.item_type==='event'){if(!['M1B_MANUAL_QA','PRIVATE_COOKIE_EVENT_CREATE'].includes(row.origin)||p.source!=='M1B_DEV_AGENDA_TEST'||typeof p.time!=='string'||normalizeCloudRecords([row],row.owner_id).events.length!==1)return false;privateEventDetails(p);privateAllDayEvent(p);privateEventRange(p);return true;}
  if(!title(p.title))return false;
  if(row.item_type==='school_fixture')return supportsPrivateSchoolRestore(row);
  if(row.item_type==='saved_search'){
   if(!keys(p,['fictional','title','filters','source','schemaVersion']))return false;
   privateSavedSearchState(row,row.owner_id);return true;
  }
  if(row.item_type==='list_template'){privateListTemplateState(row,row.owner_id);return true;}
  if(row.item_type==='project'){privateProjectState(row,row.owner_id);return true;}
  if(row.item_type==='note')return row.section==='Personal Life'&&['manual-test','PRIVATE_COOKIE_NOTE_CREATE'].includes(row.origin)&&keys(p,['fictional','title','body','source'])&&p.source==='M0C_DEV_LOGIN_TEST'&&p.title.length<=120&&typeof p.body==='string'&&p.body.length<=100000;
  if(!['manual-test','PRIVATE_COOKIE_TASK_CREATE'].includes(row.origin)||p.source!=='M0D_DEV_BRIEF_TEST')return false;
  const {recurrence,...base}=p;
  if(Object.hasOwn(p,'recurrence')){
   const {seriesId,ordinal,...fields}=p.recurrence;
   const schedule=validateTaskRecurrence(fields);
   if(row.origin!=='PRIVATE_COOKIE_TASK_CREATE'||p.done||ordinal!==0||seriesId!==row.id||schedule.anchorDay!==p.day)return false;
   nextTaskOccurrence({schedule,currentDueDay:p.day,completedOn:p.day});
  }
  return supportsTaskFields(row,base);
 }catch{return false;}
}

function supportsArchivedChecklist(steps){
 if(!Array.isArray(steps)||steps.length>200)return false;
 const ids=new Set();
 for(const step of steps){
  if(!step||!keys(step,['id','title','done'])||!title(step.title)||typeof step.done!=='boolean')return false;
  // Older private checklists used their saved position, including repeated titles.
  if(!Object.hasOwn(step,'id'))continue;
  if(!uuid(step.id)||ids.has(step.id.toLowerCase()))return false;
  ids.add(step.id.toLowerCase());
 }
 return true;
}

function supportsTaskFields(row,p){
 if(p.fictional!==true||!title(p.title))return false;
  if(row.item_type!=='task'||!TASK_SECTIONS.includes(row.section)||!keys(p,['fictional','title','day','done','status','source','priority','description','subtasks','homeCleaning','homeGrocery','homeDelivery'])||typeof p.done!=='boolean'||!(p.day===undefined||p.day===null||p.day===''||typeof p.day==='string'&&validDay(p.day))||p.priority!==undefined&&!TASK_PRIORITIES.includes(p.priority)||p.description!==undefined&&(typeof p.description!=='string'||p.description.length>10000))return false;
  if(p.homeCleaning!==undefined){if(row.section!=='Home')return false;normalizeHomeCleaning(p.homeCleaning);}if(p.homeGrocery!==undefined){if(row.section!=='Home')return false;normalizeHomeGrocery(p.homeGrocery);}if(p.homeDelivery!==undefined){if(row.section!=='Home')return false;normalizeHomeDelivery(p.homeDelivery);}
  if(p.status!==undefined&&(!['Not Started','In Progress','Completed'].includes(p.status)||(p.status==='Completed')!==p.done))return false;
  if(p.subtasks!==undefined&&!supportsArchivedChecklist(p.subtasks))return false;
 return true;
}

// PostgreSQL supports six fractional digits. Date.parse alone would lose the last three.
export function privateRestoreTimestamp(value){
 if(typeof value!=='string')throw Error('Exact string timestamps required.');
 const match=value.match(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d{1,6}))?(?:Z|[+-]\d\d:\d\d)$/);
 if(!match||!Number.isFinite(Date.parse(value)))throw Error('Exact PostgreSQL timestamp required.');
 return(BigInt(Date.parse(value))*1000n+BigInt((match[1]??'').padEnd(6,'0').slice(3))).toString();
}
export function privateWorkspaceRestoreDigest(rows){
 const canonical=rows.map(row=>{
  if(Object.keys(row).sort().join(',')!=='created_at,deleted_at,household_id,id,item_type,origin,owner_id,payload,section,updated_at,version,visibility')throw Error('Complete archived metadata required.');
  return{...row,created_at:privateRestoreTimestamp(row.created_at),updated_at:privateRestoreTimestamp(row.updated_at),deleted_at:row.deleted_at===null?null:privateRestoreTimestamp(row.deleted_at)};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

// Restore a tombstone as a tombstone; never restart the approved recovery period.
export function withinArchivedDeletedRetention(row,{now=Date.now()}={}){const value=safeSavedAt(row?.deleted_at);return Boolean(Number.isFinite(now)&&value&&withinPrivateRecoveryWindow(value,now));}
export function supportsArchivedDeletedWorkspaceRestore(row,options={}){return row?.item_type!=='brief_preferences'&&withinArchivedDeletedRetention(row,options)&&supportsOrdinaryWorkspaceRestore({...row,deleted_at:null});}

function supportsSeriesRecord(row){
 const {recurrence,recurrence_completion:marker,recurrence_predecessor:previous,recurrenceStopped:stopped,...base}=row.payload;
 if(!supportsTaskFields(row,base)||!recurrence||Object.keys(recurrence).sort().join(',')!=='anchorDay,frequency,interval,ordinal,seriesId')return false;
 if(stopped!==undefined&&stopped!==true||stopped&&marker!==undefined)return false;
 if(row.id===recurrence.seriesId){
  if(!['manual-test','PRIVATE_COOKIE_TASK_CREATE'].includes(row.origin)||base.source!=='M0D_DEV_BRIEF_TEST'||previous!==undefined)return false;
 }else if(row.origin!=='PRIVATE_RECURRING_CHORE'||!uuid(previous)||base.source!==undefined)return false;
 if(marker!==undefined){
  if(!marker||Object.keys(marker).sort().join(',')!=='baseVersion,nextDay,operationId,reviewDay,schedule,successorId'||!uuid(marker.operationId)||!uuid(marker.successorId)||!Number.isInteger(marker.baseVersion)||marker.baseVersion<1||marker.baseVersion>=row.version)return false;
  validateTaskRecurrence(marker.schedule);
 }
 return true;
}

// Reuse original completion links, including intentionally skipped dates. The destination
// must contain only exact archived members of any series about to receive missing records.
export function restorableRoutineIds({inserts,existing,archive,ownerId,now}){
 const seriesOf=row=>row.item_type==='task'?row.payload?.recurrence?.seriesId:null;
 const wanted=new Set(inserts.filter(row=>row.deleted_at===null).map(seriesOf).filter(Boolean)),groups=new Map();
 for(const series of wanted)groups.set(series,{saved:[],destination:[]});
 for(const row of archive)groups.get(seriesOf(row))?.saved.push(row);
 for(const row of existing)groups.get(seriesOf(row))?.destination.push(row);
 const supported=new Set();
 for(const [series,{saved,destination}] of groups){
  try{
   const first=saved.find(row=>row.id===series),byId=new Map(saved.map(row=>[row.id,row]));
   if(!first||!saved.every(supportsSeriesRecord)||destination.some(row=>!byId.has(row.id)||privateWorkspaceRestoreDigest([row])!==privateWorkspaceRestoreDigest([byId.get(row.id)])))continue;
   analyzeRoutineSeries(saved,{owner:ownerId,selected:first,now},area=>TASK_SECTIONS.includes(area));
   const operations=saved.flatMap(row=>row.payload.recurrence_completion?[row.payload.recurrence_completion.operationId]:[]);
   if(new Set(operations).size!==operations.length)continue;
   for(const row of saved)supported.add(row.id);
  }catch{continue;}
 }
 return supported;
}
