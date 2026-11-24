// M1D: fixed fictional school, finance and household records. Never import real data.
import { addDays, dayString } from './core.mjs';
import { validDay } from './dev-brief-model.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const LIFE_EXAMPLES=Object.freeze([
  Object.freeze({id:'course-assessment',source:'school',section:'School',type:'school_fixture',title:'Sample course assessment',detail:'Fictional practice checkpoint (not imported from WGU)',offset:2,amount:null,kind:'Assessment'}),
  Object.freeze({id:'study-session',source:'school',section:'School',type:'school_fixture',title:'Sample study session',detail:'Fictional 90-minute study block',offset:1,amount:null,kind:'Study block'}),
  Object.freeze({id:'utility-bill',source:'finances',section:'Finances',type:'bill_fixture',title:'Sample utility bill',detail:'Fictional unpaid bill; no bank connection',offset:3,amount:86.40,kind:'Bill'}),
  Object.freeze({id:'kitchen-reset',source:'household',section:'Home',type:'household_fixture',title:'Sample kitchen reset',detail:'Fictional cleaning responsibility; private, not shared',offset:0,amount:null,kind:'Cleaning'}),
  Object.freeze({id:'maintenance',source:'household',section:'Home',type:'household_fixture',title:'Sample filter replacement',detail:'Fictional maintenance reminder; private, not shared',offset:4,amount:null,kind:'Maintenance'})
]);
export const LIFE_SOURCES=Object.freeze(['school','finances','household']);
export const LIFE_NAMES=Object.freeze({school:'School',finances:'Finances',household:'Household'});
export function makeFictionalLife(templateId,ownerId,today=dayString()){
  const example=LIFE_EXAMPLES.find(x=>x.id===templateId);
  if(!example)throw Error('Select an available fictional example.');
  if(!UUID.test(ownerId||''))throw Error('Sign in to a verified fictional test account.');
  if(!validDay(today))throw Error('Invalid starting date for fictional example.');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:example.section,item_type:example.type,origin:'M1D_LIFE_QA',payload:{fictional:true,source:'M1D_LIFE_QA',template_id:example.id,day:addDays(today,example.offset),added_day:today,title:example.title,detail:example.detail,kind:example.kind,amount:example.amount}};
}
export function normalizeFictionalLife(raw,ownerId){
  if(!UUID.test(ownerId||'')||!Array.isArray(raw))return [];
  const approved=raw.filter(row=>{
    const p=row?.payload;
    const def=LIFE_EXAMPLES.find(x=>x.id===p?.template_id);
    return UUID.test(row?.id||'') && row.deleted_at==null && row.owner_id===ownerId && row.household_id===null && row.visibility==='private' && def &&
      row.item_type===def.type && row.section===def.section && row.origin==='M1D_LIFE_QA' && p?.fictional===true && p.source==='M1D_LIFE_QA' &&
      p.title===def.title && p.detail===def.detail && p.kind===def.kind && p.amount===def.amount && validDay(p.added_day) &&
      validDay(p.day) && p.day===addDays(p.added_day,def.offset);
  });
  const seen=new Set();
  return approved.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||a.id.localeCompare(b.id)).filter(row=>{
    if(seen.has(row.payload.template_id))return false;
    seen.add(row.payload.template_id);return true;
  });
}
export function lifeSummary(rows,source,start=dayString(),windowDays=7){
  if(!LIFE_SOURCES.includes(source)||!validDay(start)||!Number.isInteger(windowDays)||windowDays<1||windowDays>31)throw Error('Invalid fictional summary window.');
  const end=addDays(start,windowDays-1);
  const all=(Array.isArray(rows)?rows:[]).filter(r=>{
    const def=LIFE_EXAMPLES.find(x=>x.id===r?.payload?.template_id);
    return def?.source===source && r?.payload?.fictional===true && validDay(r.payload.day);
  });
  // Include overdue fictional records for visibility, plus the chosen window. No real-time claims.
  return all.filter(r=>r.payload.day<=end).sort((a,b)=>a.payload.day.localeCompare(b.payload.day)||a.id.localeCompare(b.id));
}
export function lifeSuggestions(rows){
  return (Array.isArray(rows)?rows:[]).flatMap(row=>{
    const p=row?.payload;
    const t=LIFE_EXAMPLES.find(x=>x.id===p?.template_id);
    if(row?.deleted_at!=null||!t||!UUID.test(row?.id||'')||!validDay(p?.day))return [];
    if(t.id==='course-assessment')return [{id:`life-fixture-${row.id}`,recordId:row.id,sourceId:row.id,sourceVersion:row.version,uncertainty:'Confirm the assessment date and whether it still needs preparation.',source:'school',rule:'school_to_task',section:'School',day:p.day,title:'Review fictional assessment checklist',reason:`Your saved fictional school record “${t.title}” is approaching. This task requires approval.`}];
    if(t.id==='maintenance')return [{id:`life-fixture-${row.id}`,recordId:row.id,sourceId:row.id,sourceVersion:row.version,uncertainty:'Confirm the filter still needs replacement and the saved date is current.',source:'household',rule:'household_to_task',section:'Home',day:p.day,title:'Check fictional filter replacement',reason:`Your saved fictional household record “${t.title}” has a due date. This task requires approval.`}];
    return [];
  });
}
export function isLifeFixtureSuggestion(s){
  return !!s && (s.source==='school'&&s.rule==='school_to_task'||s.source==='household'&&s.rule==='household_to_task') && /^life-fixture-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id||'');
}
