import {createPrivateRecordVersionPanel} from './private-record-version-panel.mjs';
import {PRIVATE_RECOVERY_DAYS, privateRecoveryDeadline, withinPrivateRecoveryWindow} from './private-record-retention.mjs';
import {isSchoolSearchType,SCHOOL_SEARCH_LABELS} from './private-school-search-types.mjs';
import {CALENDAR_FILTER_KEYS,validCalendarShortcut} from './private-calendar-filters.mjs';
import {documentShortcutFilters,isDocumentShortcut,DOCUMENT_COLLECTIONS} from './private-document-fields.mjs';
import {escapeHtml as e} from './core.mjs';
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const keys=['query','type','section','status','priority','dateFrom','dateTo','dateStatus'];
const day=value=>typeof value==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function validSavedSearchFilters(f){
 if(isDocumentShortcut(f)){try{return documentShortcutFilters(f).query===f.query;}catch{return false;}}
 const calendar=CALENDAR_FILTER_KEYS.some(k=>Object.hasOwn(f??{},k));
 const accepted=calendar?[...keys,...CALENDAR_FILTER_KEYS]:keys;
 return Boolean(f&&(!calendar||validCalendarShortcut(f))&&Object.keys(f).length===accepted.length&&Object.keys(f).every(k=>accepted.includes(k))&&typeof f.query==='string'&&f.query===f.query.trim()&&f.query.length<=100&&!/[\u0000-\u001f\u007f]/.test(f.query)&&(['all','task','note','event','project'].includes(f.type)||isSchoolSearchType(f.type))&&(f.type!=='all'||f.query)&&['all','Home','Personal Life','Work','School','Calendar'].includes(f.section)&&(!isSchoolSearchType(f.type)||['all','School'].includes(f.section))&&['all','open','completed'].includes(f.status)&&(f.type==='task'||f.status==='all')&&['all','Low','Normal','High','Urgent'].includes(f.priority)&&(f.type==='task'||f.priority==='all')&&['all','dated','undated'].includes(f.dateStatus)&&(f.type==='task'||f.dateStatus==='all')&&[f.dateFrom,f.dateTo].every(v=>v===''||day(v))&&(!f.dateFrom||!f.dateTo||f.dateFrom<=f.dateTo)&&(!(f.dateFrom||f.dateTo)||['task','event'].includes(f.type)&&f.dateStatus!=='undated'));}
const sameFilters=(a,b)=>validSavedSearchFilters(a)&&validSavedSearchFilters(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>a[k]===b[k]);
const name=value=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=80&&!/[\u0000-\u001f\u007f]/.test(value);
export function savedSearchSummary(f){if(!validSavedSearchFilters(f))return'Filters unavailable';if(f.type==='document-text')return 'File contents containing “'+f.query+'”';if(f.type==='document-library')return DOCUMENT_COLLECTIONS[f.collection]+(f.query?' · Name, folder or tag containing “'+f.query+'”':'');return[...(validCalendarShortcut(f)?[({all:'All event types',timed:'Timed events',allDay:'All-day events'})[f.eventKind],({all:'All calendar sources',manual:'Manual calendar',saved:'Saved calendar',other:'Other saved calendar'})[f.eventSource],f.eventCategory==='all'?'All event categories':f.eventCategory]:[]),...(isSchoolSearchType(f.type)?[SCHOOL_SEARCH_LABELS[f.type]]:[]),f.query?'Title contains “'+f.query+'”':(isSchoolSearchType(f.type)?'All matching titles':'All '+f.type+' titles'),f.section==='all'?'All sections':f.section,...(f.type==='task'?[f.status==='all'?'All statuses':f.status,f.priority==='all'?'All priorities':f.priority+' priority',({all:'All dates',dated:'With a due date',undated:'No due date'})[f.dateStatus]]:[]),f.dateFrom?'From '+f.dateFrom:'',f.dateTo?'Through '+f.dateTo:''].filter(Boolean).join(' · ');}
function verifyShortcutVersion(value,{entry,now,maxExpiry}){
 const keys=['readOnly','historical','expiresAt','version','operation','capturedAt','wasDeleted','record',...(entry.recoveredAt?['recoveredAt']:[])];
 if(!value||Object.keys(value).sort().join(',')!==keys.sort().join(',')||value.readOnly!==true||value.historical!==true||
    !Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>Math.min(maxExpiry,now+300000)||
    ['version','operation','capturedAt','recoveredAt'].some(key=>value[key]!==entry[key])||typeof value.wasDeleted!=='boolean'||
    !value.record||Object.keys(value.record).sort().join(',')!=='filters,name'||!name(value.record.name)||!validSavedSearchFilters(value.record.filters))throw Error('Earlier shortcut could not be verified.');
 return value;
}
export function createSavedSearchPanel({client,clock=Date.now,canUse,onChange,onOpen,onRun,allowHistory=false,allowSchool=false,allowDocuments=false}){
 let generation=0,offer=null,list=null,form=null,review=null,busy=false,locked=false,message='',timer=null,disposed=false,pendingWrite=null;
 let historySource=null;
 const inScope=filters=>(allowSchool||!isSchoolSearchType(filters.type))&&(allowDocuments||!isDocumentShortcut(filters));
 const history=allowHistory?createPrivateRecordVersionPanel({
  kind:'shortcut',client,clock,source:()=>historySource,canUse:()=>canUse()&&!busy&&!locked&&!form&&!review&&!pendingWrite,
  onChange:()=>notify(),verifyDetails(value,options){
   const detail=verifyShortcutVersion(value,options);
   if(!inScope(detail.record.filters))throw Error('Shortcut scope unavailable.');
   return detail;
  },
  draftActions:[{
   id:'use-filters',label:'Run search with earlier filters',
   canUse:detail=>inScope(detail.record.filters),
   onUse:detail=>{void useSelected(historySource.savedSearchToken,detail,'search');}
  },{
   id:'use-name',label:'Use earlier name in rename draft',
   canUse:detail=>detail.record.name!==historySource?.name,
   onUse:detail=>{void useSelected(historySource.savedSearchToken,detail,'rename');}
  }],
  renderDetails:detail=>'<h3>'+e(detail.record.name)+'</h3><p>'+e(savedSearchSummary(detail.record.filters))+'</p><p>'+(detail.wasDeleted?'Removed at capture':'Active at capture')+'</p>'
 }):null;
 function clearHistory(){historySource=null;history?.reset();}
 const active=n=>!disposed&&n===generation;
 const current=n=>active(n)&&canUse();
 const notify=focus=>{if(!disposed)onChange(canUse()?focus:undefined);};
 function reset(){clearHistory();generation++;clearTimeout(timer);offer=null;list=null;form=null;review=null;busy=false;locked=false;message='';}
 function expire(){clearHistory();clearTimeout(timer);if(pendingWrite){offer=null;list=null;review=null;locked=true;message='The review expired while its save is being checked. Wait for the result before continuing.';return;}generation++;offer=null;list=null;review=null;busy=false;locked=Boolean(form);message='This saved-search view expired. Check saved searches before reviewing again.';}
 function expireAt(time){
  clearTimeout(timer);
  timer=setTimeout(()=>{
   if(disposed)return;
   if(time>clock()){expireAt(time);return;}
   expire();notify();
  },Math.max(1,time-clock()));
 }
 function removedViewExpired(){return list?.removed&&Math.min(list.expiresAt,review?.expiresAt??Infinity)<=clock();}
 function validExpiry(time){return Number.isFinite(time)&&time>clock()&&time<=clock()+300000;}
 function setOffer(result){if(disposed||pendingWrite||!canUse())return;reset();const fields=validCalendarShortcut(result)?[...keys,...CALENDAR_FILTER_KEYS]:keys;const filters=Object.fromEntries(fields.map(k=>[k,result[k]]));if(!token(result.saveSearchToken)||!validSavedSearchFilters(filters)||!validExpiry(result.saveSearchExpiresAt))return;offer={key:result.saveSearchToken,filters,expiresAt:result.saveSearchExpiresAt};expireAt(offer.expiresAt);}
 async function show(removed=false,offset=0){if(disposed||!canUse()||busy||pendingWrite||form||review)return;const n=++generation;clearHistory();clearTimeout(timer);offer=null;list=null;locked=false;busy=true;message='';onOpen();notify();try{const v=await client.savedSearches({removed,offset});if(!current(n))return;
  if(v.removed!==removed||v.offset!==offset||v.limit!==50||v.retentionDays!==PRIVATE_RECOVERY_DAYS||!token(v.viewId)||!validExpiry(v.expiresAt)||!Number.isInteger(v.matchCount)||v.matchCount<0||v.matchCount>2000||!Array.isArray(v.records)||v.records.length>50||v.records.length>Math.max(0,v.matchCount-offset)||v.records.some(r=>!name(r.name)||!validSavedSearchFilters(r.filters)||!token(r.savedSearchToken)||removed&&(typeof r.deletedAt!=='string'||!withinPrivateRecoveryWindow(r.deletedAt,clock())))||new Set(v.records.map(r=>r.savedSearchToken)).size!==v.records.length)throw Error('Saved searches could not be verified.');
  const expiresAt=removed?Math.min(v.expiresAt,...v.records.map(row=>privateRecoveryDeadline(row.deletedAt))):v.expiresAt;
  list={...v,expiresAt};expireAt(expiresAt);notify('#private-saved-searches-title');
 }catch(error){if(current(n)){list=null;message=error.message;}}finally{if(active(n)){busy=false;notify(review?'#private-saved-search-review-title':list?'#private-saved-searches-title':undefined);}}}
 function startCreate(){if(disposed||!canUse()||busy||pendingWrite||form||review||!offer)return;form={action:'create',name:'',filters:structuredClone(offer.filters),saveSearchToken:offer.key};locked=false;message='';notify('[name="saved-search-name"]');}
 function startRename(key,initialName){if(disposed||!canUse()||busy||pendingWrite||form||review||list?.removed)return;const r=list?.records.find(r=>r.savedSearchToken===key);if(!r)return;clearHistory();form={action:'rename',name:initialName??r.name,filters:structuredClone(r.filters),savedSearchToken:key};locked=false;message='';notify('[name="saved-search-name"]');}
 async function prepare(action,key){if(disposed||!canUse()||busy||pendingWrite||review||locked)return;let values,expected;
  if(action==='create'||action==='rename'){if(!form||form.action!==action||!name(form.name.trim())){message='Enter a search name up to 80 characters.';notify('[name="saved-search-name"]');return;}values={action,name:form.name.trim(),...(action==='create'?{saveSearchToken:form.saveSearchToken}:{savedSearchToken:form.savedSearchToken})};expected={name:values.name,filters:form.filters};}
  else{if(form)return;const r=list?.records.find(r=>r.savedSearchToken===key);if(!r||!['remove','restore'].includes(action)||(action==='restore')!==list.removed)return;values={action,savedSearchToken:key};expected=r;}
  clearHistory();const n=++generation;busy=true;message='';notify();try{const v=await client.reviewSavedSearch(values);if(!current(n))return;if(v.noChanges===true&&action==='rename'){form=null;message='The name is unchanged.';return;}
   if(v.action!==action||v.name!==expected.name||!sameFilters(v.filters,expected.filters)||!token(v.reviewId)||!validExpiry(v.expiresAt))throw Error('Saved-search review could not be verified.');if(removedViewExpired()){expire();return;}
   review={...v,expiresAt:action==='restore'?Math.min(v.expiresAt,list.expiresAt):v.expiresAt};expireAt(review.expiresAt);notify('#private-saved-search-review-title');
  }catch(error){if(current(n)){locked=true;message=error.message;}}finally{if(active(n)){busy=false;notify(review?'#private-saved-search-review-title':list?'#private-saved-searches-title':undefined);}}}
 async function approve(){if(disposed||!canUse()||busy||pendingWrite||!review||locked)return;const expected=review.action,id=review.reviewId,n=++generation,marker={};pendingWrite=marker;busy=true;locked=true;review=null;message='';notify();try{const v=await client.saveSavedSearch(id);if(!current(n))return;if(v.saved!==true||v.action!==expected)throw Error('Shortcut save could not be confirmed. Check saved searches before trying again.');reset();message=({create:'Search saved.',rename:'Saved search renamed.',remove:'Saved search moved to Removed saved searches. Matching records are unchanged.',restore:'Saved search restored.'})[expected];notify('[role="status"]');}
  catch(error){if(current(n)){offer=null;list=null;message=error.message+' Check saved searches before starting another save.';}}finally{if(pendingWrite===marker){pendingWrite=null;if(active(n)){busy=false;notify(review?'#private-saved-search-review-title':list?'#private-saved-searches-title':undefined);}else notify();}}}
 async function cancel(){if(disposed||!canUse()||busy||pendingWrite)return;const n=++generation;busy=true;review=null;message='';notify();try{await client.cancelSavedSearch();if(!current(n))return;reset();notify('#private-saved-searches-open');}catch(error){if(current(n)){locked=true;message=error.message;}}finally{if(active(n)){busy=false;notify(review?'#private-saved-search-review-title':list?'#private-saved-searches-title':undefined);}}}
 async function useSelected(key,earlier=null,action='search'){
  if(disposed||!canUse()||busy||pendingWrite||form||review||!list||list.removed)return;
  const expected=list.records.find(row=>row.savedSearchToken===key);
  const expiresAt=Math.min(list.expiresAt,earlier?.expiresAt??Infinity);
  if(!expected||expiresAt<=clock())return;
  clearHistory();const n=++generation;busy=true;message='';notify();
  try{
   const loaded=await client.loadSavedSearch(key);
   if(!current(n))return;
   if(expiresAt<=clock()||loaded.name!==expected.name||!sameFilters(loaded.filters,expected.filters))throw Error('Saved search changed or expired. Check saved searches again.');
   if(action==='rename'){
    generation++;busy=false;startRename(key,earlier.record.name);return;
   }
   const filters=earlier?earlier.record.filters:loaded.filters;
   if(!inScope(filters))throw Error('These search filters are unavailable in this workspace.');
   reset();onRun(structuredClone(filters));
  }catch(error){if(current(n)){list=null;message=error.message;}}
  finally{if(active(n)){busy=false;notify();}}
 }
 function render(){if(disposed||!canUse())return'';if(removedViewExpired())expire();const disabled=busy||Boolean(pendingWrite)||!canUse();let html=`<button class="btn" type="button" id="private-saved-searches-open" ${disabled||form||review?'disabled':''}>Saved searches</button>`;
  if(message)html+=`<p role="status" class="notice">${e(message)}</p>`;
  if(busy)html+='<p role="status">Checking saved searches…</p>';
  if(offer&&!form&&!review&&!list)html+=`<section class="panel"><h2>Save this applied search</h2><p>${e(savedSearchSummary(offer.filters))}</p><p class="tiny muted">Saves these filters only. Dates stay fixed; no results or search history are saved.</p><button class="btn" id="private-saved-search-new" type="button" ${disabled?'disabled':''}>Name this search</button></section>`;
  if(list&&!form&&!review)html+=`<section class="panel" aria-labelledby="private-saved-searches-title"><h2 id="private-saved-searches-title">${list.removed?'Removed saved searches':'Saved searches'}</h2><p>${list.matchCount} shortcut(s). ${list.removed?'Restore within 90 days.':'Run a shortcut to search current records and files. Saved dates stay fixed.'}</p><button class="btn" id="private-saved-search-mode" type="button" ${disabled?'disabled':''}>${list.removed?'Active saved searches':'Removed saved searches'}</button><button class="btn" id="private-saved-search-close" type="button" ${disabled?'disabled':''}>Close saved searches</button>${list.records.length?'<ul class="item-list">'+list.records.map(r=>`<li class="item"><div class="item-main"><strong>${e(r.name)}</strong><small>${e(savedSearchSummary(r.filters))}${list.removed?' · Removed '+e(r.deletedAt.slice(0,10)):''}</small></div>${list.removed?`<button class="btn btn-small" data-saved-restore="${e(r.savedSearchToken)}" ${disabled?'disabled':''}>Review restoration</button>`:`<button class="btn btn-small" data-saved-run="${e(r.savedSearchToken)}" ${disabled?'disabled':''}>Run search</button><button class="btn btn-small" data-saved-rename="${e(r.savedSearchToken)}" ${disabled?'disabled':''}>Rename</button>${history&&inScope(r.filters)?`<button class="btn btn-small" data-saved-versions="${e(r.savedSearchToken)}" ${disabled?'disabled':''}>View versions</button>`:''}<button class="btn btn-small" data-saved-remove="${e(r.savedSearchToken)}" ${disabled?'disabled':''}>Review removal</button>`}</li>`).join('')+'</ul>':'<p class="empty">No saved searches in this view.</p>'}<nav class="widget-toolbar" aria-label="Saved search pages"><button class="btn" id="private-saved-search-previous" ${disabled||list.offset===0?'disabled':''}>Previous shortcuts</button><button class="btn" id="private-saved-search-next" ${disabled||list.offset+50>=list.matchCount?'disabled':''}>Next shortcuts</button></nav></section>`;
  if(form&&!review)html+=`<form class="panel" id="private-saved-search-name-form" autocomplete="off"><h2>${form.action==='create'?'Name this search':'Rename saved search'}</h2><p>${e(savedSearchSummary(form.filters))}</p><label class="field-label">Search name<input name="saved-search-name" autocomplete="off" maxlength="80" value="${e(form.name)}" required ${disabled||locked?'disabled':''}></label><button class="btn" type="submit" ${disabled||locked?'disabled':''}>Review shortcut</button><button class="btn" type="button" id="private-saved-search-cancel" ${busy||Boolean(pendingWrite)?'disabled':''}>Discard shortcut draft</button>${locked?'<p class="warning">Keep the name and filters above for reference. Check saved searches before another save.</p>':''}</form>`;
  if(review)html+=`<section class="panel" aria-labelledby="private-saved-search-review-title"><h2 id="private-saved-search-review-title">Review ${e({create:'saving this search',rename:'renaming this search',remove:'removing this shortcut',restore:'restoring this shortcut'}[review.action])}</h2><p><strong>${e(review.name)}</strong></p><p>${e(savedSearchSummary(review.filters))}</p><p>${review.action==='remove'?'Removes only this shortcut. Matching tasks, notes and events stay unchanged; restore the shortcut within 90 days.':'Only this private shortcut changes. No search runs and no matching records change.'}</p><button class="btn btn-primary" id="private-saved-search-approve" ${disabled?'disabled':''}>${e({create:'Approve saving this search',rename:'Approve renaming this search',remove:'Approve shortcut removal',restore:'Approve shortcut restoration'}[review.action])}</button><button class="btn" id="private-saved-search-cancel" ${busy||Boolean(pendingWrite)?'disabled':''}>Cancel shortcut review</button></section>`;
  if(historySource&&list&&!form&&!review)html+='<section aria-label="Selected shortcut history"><h3>Versions of '+e(historySource.name)+'</h3>'+history.render()+'</section>';
  return html;
 }
 function click(event){if(removedViewExpired()){expire();notify();}const hit=selector=>event.target.closest(selector);
 if(historySource&&history?.click(event))return true;
 const versions=hit('[data-saved-versions]');
 if(versions){
  const row=list?.records.find(row=>row.savedSearchToken===versions.dataset.savedVersions);
  if(history&&row&&canUse()&&!list.removed&&!busy&&!form&&!review&&!pendingWrite&&validExpiry(list.expiresAt)&&inScope(row.filters)){
   clearHistory();historySource={savedSearchToken:row.savedSearchToken,name:row.name,expiresAt:list.expiresAt};
   void history.load();
  }
  return true;
 }
 if(hit('#private-saved-searches-open')){void show();return true;}if(hit('#private-saved-search-new')){startCreate();return true;}if(hit('#private-saved-search-cancel')||hit('#private-saved-search-close')){void cancel();return true;}if(hit('#private-saved-search-approve')){void approve();return true;}if(hit('#private-saved-search-mode')){if(list)void show(!list.removed);return true;}for(const [selector,delta]of [['#private-saved-search-previous',-50],['#private-saved-search-next',50]])if(hit(selector)){if(list&&list.offset+delta>=0&&list.offset+delta<list.matchCount)void show(list.removed,list.offset+delta);return true;}for(const action of ['run','rename','remove','restore']){const button=hit('[data-saved-'+action+']');if(button){const key=button.dataset['saved'+action[0].toUpperCase()+action.slice(1)];if(action==='run')void useSelected(key);else if(action==='rename')startRename(key);else void prepare(action,key);return true;}}return false;}
 return{setOffer,startDocumentOffer(result,expected){if(!canUse()||pendingWrite||busy||form||review||!isDocumentShortcut(expected)||!sameFilters(result?.filters,expected)||!token(result?.saveSearchToken)||!validExpiry(result.saveSearchExpiresAt))return false;reset();offer={key:result.saveSearchToken,filters:structuredClone(expected),expiresAt:result.saveSearchExpiresAt};expireAt(offer.expiresAt);startCreate();return true;},render,click,submit(event){if(event.target.id!=='private-saved-search-name-form')return false;event.preventDefault();if(form)void prepare(form.action);return true;},input(event){if(event.target.name!=='saved-search-name')return false;if(!disposed&&canUse()&&form&&!busy&&!pendingWrite&&!review&&!locked)form.name=event.target.value;return true;},blocked:()=>busy||Boolean(form||review||pendingWrite),visible:()=>Boolean(list||form||review),reset,offline(){clearHistory();generation++;clearTimeout(timer);offer=null;list=null;review=null;busy=false;locked=Boolean(form);message=form?'You are offline. Check saved searches before reviewing this shortcut again.':'';},dispose(){reset();history?.dispose();disposed=true;}};
}
