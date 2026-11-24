import {widgetPage,selectedPageWidgetLayout,applyPageWidgetLayout,defaultPageWidgetLayouts} from '../src/private-widget-pages.mjs';
// Original dashboard_layout record, ordinary owner-only versioned save; no source-record writes.
import {randomBytes,createHmac} from 'node:crypto';
import {makeWidgetLayoutRecord} from '../src/dev-widget-layout-model.mjs';
import {validatePrivateWidgetLayouts,defaultWidgetLayouts} from '../src/private-widget-layout.mjs';
import {privateWorkspaceRestoreDigest as digest} from './private-workspace-restore-contract.mjs';
import {privateWidgetLayoutRecord} from './private-widget-layout-record.mjs';
import {stableStringify} from './stable-json.mjs';
import {createPrivateRecordVersionReader} from './private-record-version-reader.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v),opaque=()=>randomBytes(32).toString('base64url'),same=(a,b)=>stableStringify(a)===stableStringify(b);
export function createPrivateWidgetLayout({api,now=Date.now,allowHistory=false,allowPages=false,sourcePicker=null,starterLayout=null}={}){
 if(typeof allowPages!=='boolean')throw Error('Explicit page layout scope required.');
 if(typeof allowHistory!=='boolean')throw Error('Explicit widget history scope required.');
 if(typeof now!=='function'||['listWidgetLayouts','addWidgetLayout','updateWidgetLayout'].some(k=>typeof api?.[k]!=='function'))throw Error('Explicit original widget layout adapters required.');
 if(sourcePicker&&(['begin','list','selected','resolve','ready'].some(k=>typeof sourcePicker[k]!=='function')||['setWidgetSourceAssociation','resolveWidgetSourceAssociation','getPrivateNote','getPrivateProject'].some(k=>typeof api?.[k]!=='function')))throw Error('Explicit persistent widget source adapters required.');
 const secret=randomBytes(32),contexts=new Map();let disposed=false,history=null;
 const alive=s=>!disposed&&contexts.get(s.id)===s&&s.expiresAt>now();
 function clear(id){history?.clear(id);sourcePicker?.clear(id);clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 function checked(rows,owner,page='curation'){
  if(!uuid(owner)||!Array.isArray(rows)||rows.length>1)throw Error('A single verified private layout is required.');
  for(const row of rows)privateWidgetLayoutRecord(row,owner);
  const selected=rows[0]?selectedPageWidgetLayout(rows[0].payload,page):{layouts:defaultPageWidgetLayouts(page),configured:false};return{record:rows[0]?structuredClone(rows[0]):null,layouts:selected.layouts,configured:selected.configured,baseTag:createHmac('sha256',secret).update(owner+':'+page+':'+digest(rows)).digest('base64url')};
 }
 async function latest(actor,page='curation'){
  const value=checked(await api.listWidgetLayouts(actor.accessToken,actor.ownerId),actor.ownerId,page);
  if(page!=='brief'||value.configured||!starterLayout)return value;
  const layouts=await starterLayout(actor);
  if(layouts===null)return value;
  value.layouts=validatePrivateWidgetLayouts(layouts);
  value.baseTag=createHmac('sha256',secret).update(value.baseTag+stableStringify(value.layouts)).digest('base64url');
  return value;
 }
 function state(id,actor){const s=contexts.get(id);if(!s||!alive(s)||s.owner!==actor?.ownerId)throw Error('Fetch current widget layouts again.');return s;}
 async function read(id,actor,expiresAt,{page='curation',sourceChoices=false}={}){widgetPage(page);if(page!=='curation'&&!allowPages)throw Error('Page configuration is unavailable.');if(typeof sourceChoices!=='boolean'||sourceChoices&&!sourcePicker)throw Error('Widget source choices are unavailable.');if(disposed||typeof id!=='string'||!id||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Active widget layout context required.');clear(id);const s={id,page,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),viewId:opaque(),generation:0,review:null};contexts.set(id,s);s.timer=setTimeout(()=>{if(contexts.get(id)===s)clear(id);},Math.max(1,s.expiresAt-now()));s.timer.unref?.();const value=await latest(actor,s.page);if(!alive(s))throw Error('Widget layout selection ended.');s.baseTag=value.baseTag;let sourceOptions,sourceAssociations;if(sourcePicker){sourcePicker.begin(id,actor,s.expiresAt);if(sourceChoices){await sourcePicker.ready(id,actor);sourceOptions=await sourcePicker.list(id,actor,s.expiresAt);sourceAssociations={};for(const widget of Object.values(value.layouts).flat())if(widget.sourceAssociationId&&!Object.hasOwn(sourceAssociations,widget.sourceAssociationId)){try{const source=await sourcePicker.resolve(id,actor,widget.sourceAssociationId);sourceAssociations[widget.sourceAssociationId]=source?{type:source.type,title:source.title,section:source.section,...(source.type==='project'?{status:source.status}:{})}:{available:false};}catch{sourceAssociations[widget.sourceAssociationId]={available:false};}}}}if(!alive(s))throw Error('Widget layout selection ended.');return{readOnly:false,layouts:value.layouts,hasSavedLayout:value.configured,...(s.page==='curation'?{}:{page:s.page}),baseTag:s.baseTag,viewId:s.viewId,expiresAt:s.expiresAt,...(sourceChoices?{sourceOptions,sourceAssociations}:{})};}
 async function prepare(id,actor,values){
  const s=state(id,actor);history?.clear(id);s.review=null;const generation=++s.generation;
  const keys=Object.keys(values??{}).sort().join(','),hasSelections=keys==='baseTag,layouts,sourceSelections';
  if(!values||!['baseTag,layouts',hasSelections?'baseTag,layouts,sourceSelections':''].includes(keys)||values.baseTag!==s.baseTag||hasSelections&&!sourcePicker)throw Error('Review the current complete layout.');
  const layouts=validatePrivateWidgetLayouts(values.layouts),value=await latest(actor,s.page);
  if(!alive(s)||s.generation!==generation||value.baseTag!==values.baseTag)throw Error('Widget layouts changed. Fetch current settings.');
  const sourceSelections=hasSelections?values.sourceSelections:[];
  if(!Array.isArray(sourceSelections)||sourceSelections.length>60)throw Error('Bounded current widget source selections required.');
  const selectedByAlias=new Map();
  for(const entry of sourceSelections){
   if(!entry||Object.keys(entry).sort().join(',')!=='associationId,selectionToken,sourceType'||!/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(entry.associationId||'')||!/^[A-Za-z0-9_-]{43}$/.test(entry.selectionToken||'')||!['note','project'].includes(entry.sourceType)||selectedByAlias.has(entry.associationId))throw Error('Current widget source selection required.');
   const expectedType=entry.sourceType==='note'?'notes':'projects',present=Object.values(layouts).flat().some(widget=>widget.sourceAssociationId===entry.associationId&&widget.type===expectedType);
   if(!present)throw Error('Selected source does not match a widget in this layout.');
   const chosen=await sourcePicker.selected(id,actor,entry.sourceType,entry.selectionToken);
   selectedByAlias.set(entry.associationId,{associationId:entry.associationId,type:entry.sourceType,recordId:chosen.record.id,version:chosen.record.version,selectionToken:entry.selectionToken});
  }
  for(const widget of Object.values(layouts).flat())if(widget.sourceAssociationId&&!selectedByAlias.has(widget.sourceAssociationId)){
   const existed=Object.values(value.layouts).flat().some(before=>before.sourceAssociationId===widget.sourceAssociationId&&before.type===widget.type);
   if(!existed||!await sourcePicker.resolve(id,actor,widget.sourceAssociationId))throw Error('A newly selected source must be verified before saving.');
  }
  if(same(layouts,value.layouts)&&(s.page==='curation'||value.configured)&&selectedByAlias.size===0)return{noChanges:true};
  const payload=applyPageWidgetLayout(value.record?value.record.payload:makeWidgetLayoutRecord(defaultWidgetLayouts(),actor.ownerId).payload,s.page,layouts);
  s.review={id:opaque(),s,owner:s.owner,record:value.record,baseTag:value.baseTag,payload,layouts,sources:[...selectedByAlias.values()],claimed:false,started:false,authorized:false,authorizing:null};
  return{before:value.layouts,layouts:structuredClone(layouts),reviewId:s.review.id,expiresAt:s.expiresAt};
 }
 function claim(id,owner,reviewId){const s=state(id,{ownerId:owner}),r=s.review;if(!r||r.id!==reviewId||r.claimed)throw Error('Widget layout approval ended.');s.review=null;r.claimed=true;r.generation=++s.generation;return r;}
 const active=(r,actor)=>Boolean(r?.claimed&&!r.started&&alive(r.s)&&r.owner===actor?.ownerId&&r.s.generation===r.generation);
 async function authorize(r,actor){if(!r)return false;r.authorized=false;const marker={};r.authorizing=marker;try{if(!active(r,actor))return false;const value=await latest(actor,r.s.page);if(r.authorizing!==marker||!active(r,actor)||value.baseTag!==r.baseTag)return false;for(const source of r.sources){const current=await sourcePicker.selected(r.s.id,actor,source.type,source.selectionToken);if(!active(r,actor)||current.record.id!==source.recordId||current.record.version!==source.version)return false;}r.authorized=true;return true;}finally{if(r.authorizing===marker)r.authorizing=null;}}
 async function save(r,actor){if(!active(r,actor)||!r.authorized||r.authorizing)throw Error('Widget layout approval ended.');r.started=true;r.authorized=false;const rows=await(r.record?api.updateWidgetLayout(actor.accessToken,r.record,actor.ownerId,structuredClone(r.payload)):api.addWidgetLayout(actor.accessToken,{...makeWidgetLayoutRecord(defaultWidgetLayouts(),actor.ownerId),payload:structuredClone(r.payload)}));if(!alive(r.s)||r.s.generation!==r.generation)throw Error('Widget layout save could not be confirmed.');const ack=checked(rows,actor.ownerId,r.s.page);if(!ack.record||ack.record.version!==(r.record?r.record.version+1:1)||!same(ack.record.payload,r.payload)||r.record&&digest([ack.record])!==digest([{...r.record,payload:r.payload,version:r.record.version+1,updated_at:ack.record.updated_at}]))throw Error('Widget layout acknowledgement differs.');for(const source of r.sources){const result=await api.setWidgetSourceAssociation(actor.accessToken,{associationId:source.associationId,recordId:source.recordId,itemType:source.type,layoutRecordId:ack.record.id,layoutVersion:ack.record.version,sourceVersion:source.version});if(!alive(r.s)||r.s.generation!==r.generation||!result||result.associationId!==source.associationId||result.saved!==true)throw Error('Widget source link could not be confirmed.');}const value=await latest(actor,r.s.page);if(!alive(r.s)||r.s.generation!==r.generation||!value.record||digest([value.record])!==digest([ack.record]))throw Error('Widget layout changed during save verification.');clear(r.s.id);return{saved:true,layouts:structuredClone(value.layouts)};}
 async function readSource(id,actor,viewId,associationId){const s=state(id,actor);if(s.viewId!==viewId||s.review||!sourcePicker)throw Error('Current widget source view required.');const value=await latest(actor,s.page);if(!alive(s)||s.viewId!==viewId||value.baseTag!==s.baseTag)throw Error('Current widget layout changed. Fetch latest.');const widgets=Object.values(value.layouts).flat().filter(widget=>widget.sourceAssociationId===associationId);if(!widgets.length||widgets.some(widget=>!['notes','projects'].includes(widget.type))||new Set(widgets.map(widget=>widget.type)).size!==1)throw Error('Selected source is no longer linked to a supported widget.');const source=await sourcePicker.resolve(id,actor,associationId);if(!alive(s)||s.viewId!==viewId||!source||widgets[0].type!==(source.type==='note'?'notes':'projects'))throw Error('Selected widget source is unavailable.');return{page:s.page,source,expiresAt:s.expiresAt};}
 history=allowHistory?createPrivateRecordVersionReader({api,now,resolveSource:async(id,actor,viewId)=>{const s=state(id,actor);if(s.viewId!==viewId||s.review)throw Error('Current widget view required.');const value=await latest(actor,s.page);if(!alive(s)||!value.record||s.baseTag!==value.baseTag)throw Error('Current widget source changed.');return{record:value.record,expiresAt:s.expiresAt};},describeSnapshot:(row,{contextId})=>{const s=contexts.get(contextId);if(!s||!alive(s))throw Error('Current page context required.');privateWidgetLayoutRecord({...row,deleted_at:null},row.owner_id);const selected=selectedPageWidgetLayout(row.payload,s.page);return{layouts:selected.layouts,...(s.page==='curation'?{}:{page:s.page,configured:selected.configured})};}}):null;
 return{read,readSource,prepare,claim,authorize,save,clear,...(history?{listVersions:(id,actor,viewId,options)=>history.list(id,actor,viewId,state(id,actor).expiresAt,options),readVersion:(id,actor,token)=>history.read(id,actor,token)}:{}),current:(id,reviewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).review?.id===reviewId),currentView:(id,viewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===viewId),dispose(){disposed=true;history?.dispose();for(const id of contexts.keys())clear(id);secret.fill(0);}};
}
