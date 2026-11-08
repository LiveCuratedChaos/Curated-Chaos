// Curated Chaos M1A -- deterministic, fictional cross-section fixtures.
// NEVER read email/calendar/finance providers or write fixture values to the cloud.
import { addDays, dayString, safeAutomationMode } from './core.mjs';
import { validDay, TASK_SECTIONS } from './dev-brief-model.mjs';
import { isEmailFixtureSuggestion } from './dev-email-model.mjs';
import { isLifeFixtureSuggestion } from './dev-life-model.mjs';
export const INTEGRATION_SOURCES=['calendar','email','school','finances','household'];
export const SOURCE_LABELS={calendar:'Calendar',email:'Email',school:'School',finances:'Finances',household:'Household'};
export function fictionalSources(today=dayString()){
  if(!validDay(today)) throw Error('Invalid fixture date.');
  return {
    calendar:[
      {id:'calendar-checkin',day:today,time:'10:00 AM',title:'Sample project check-in',detail:'30-minute fictional calendar meeting'},
      {id:'calendar-errand',day:addDays(today,1),time:'2:30 PM',title:'Sample appointment',detail:'Fictional calendar appointment'},
      {id:'calendar-family',day:addDays(today,2),time:'6:00 PM',title:'Sample household planning',detail:'Fictional shared event; no live household data'}
    ],
    email:[
      {id:'email-reminder',day:today,title:'Sample appointment email',detail:'Example email suggests confirming an appointment. No mailbox is connected.'},
      {id:'email-receipt',day:addDays(today,1),title:'Sample receipt notification',detail:'Example purchase email. No messages or receipts were accessed.'}
    ],
    school:[
      {id:'school-guide',day:addDays(today,2),title:'Sample course assessment',detail:'Practice assessment checkpoint; no WGU records were accessed.'},
      {id:'school-study',day:today,title:'Sample study block',detail:'Example 90-minute school study session.'}
    ],
    finances:[
      {id:'finance-bill',day:addDays(today,3),title:'Sample utility bill',detail:'Fictional bill due',amount:85.20},
      {id:'finance-subscription',day:addDays(today,5),title:'Sample subscription',detail:'Fictional recurring charge',amount:12.99}
    ],
    household:[
      {id:'household-groceries',day:today,title:'Sample grocery reminder',detail:'Fictional household checklist'},
      {id:'household-maintenance',day:addDays(today,4),title:'Sample home maintenance',detail:'Fictional maintenance task'}
    ],
    suggestions:[
      {id:'sug-email',source:'email',rule:'email_to_task',section:'Personal Life',day:today,title:'Confirm fictional appointment',reason:'A sample email mentions an upcoming appointment. Nothing is added without your approval.'},
      {id:'sug-school',source:'school',rule:'school_to_task',section:'School',day:addDays(today,2),title:'Review fictional assessment rubric',reason:'A sample school deadline may warrant a preparation task.'},
      {id:'sug-household',source:'household',rule:'household_to_task',section:'Home',day:addDays(today,4),title:'Review fictional maintenance checklist',reason:'A sample household reminder may warrant a task.'}
    ]
  };
}
export function sourceEnabled(source,selections){return INTEGRATION_SOURCES.includes(source) && selections?.[source]===true;}
export function visibleFixtures(fixtures,selections){
  return Object.fromEntries(INTEGRATION_SOURCES.map(s=>[s,sourceEnabled(s,selections)?fixtures[s]:[]]));
}
export function isDuplicateTask(tasks,draft){
  const norm=x=>String(x||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
  return tasks.some(t=>t?.item_type==='task' && t.payload?.fictional===true && ((draft.id && t.payload?.source==='M1A_APPROVED_'+draft.id) || (norm(t.payload?.title)===norm(draft.title) && t.payload?.day===draft.day)));
}
export function validateSuggestedTask(fixture,draft){
  if(!fixture || fixture.rule!=='email_to_task' && !['school_to_task','household_to_task'].includes(fixture.rule))throw Error('Suggestion unavailable.');
  const title=String(draft?.title||'').trim(), day=String(draft?.day||fixture.day),section=String(draft?.section||fixture.section);
  if(!title || title.length>140 || !validDay(day) || !TASK_SECTIONS.includes(section))throw Error('Check the fictional task title, date and section.');
  if(safeAutomationMode(fixture.rule,'automatic')!=='ask' && fixture.rule==='email_to_task')throw Error('Email actions require review.');
  return {title,day,section};
}
export function intelligentSummary(cloud,fixture,selections,today){
  const open=(cloud?.tasks||[]).filter(t=>!t.payload?.done && t.payload?.day<=today).length;
  const upcoming=(cloud?.tasks||[]).filter(t=>!t.payload?.done && t.payload?.day>today).length;
  const active=INTEGRATION_SOURCES.filter(s=>sourceEnabled(s,selections));
  const due=active.reduce((sum,s)=>sum+fixture[s].filter(item=>item.day<=today).length,0);
  return {open,upcoming,sampleToday:due,activeSources:active.length};
}

// Persist decisions as the authenticated user's own private, fictional cc_records.
// No new SQL/table, household permissions, or provider access required.
export function makeSuggestionDismissal(suggestion,ownerId){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId||'')) throw Error('Verified test account required.');
  if(!suggestion || !(fictionalSources('2026-10-30').suggestions.some(s=>s.id===suggestion.id && s.source===suggestion.source) || isEmailFixtureSuggestion(suggestion) || isLifeFixtureSuggestion(suggestion))) throw Error('Unknown fictional suggestion.');
  return {
    owner_id:ownerId, household_id:null, visibility:'private', section:'Personal Life',
    item_type:'suggestion_decision', origin:'M1A_DISMISS_QA',
    payload:{suggestion_id:suggestion.id,source:suggestion.source,status:'dismissed',fictional:true}
  };
}
export function normalizedDismissals(rows,ownerId,allowedEmailSuggestionIds=[]){
  const known=new Set(fictionalSources('2026-10-30').suggestions.map(s=>s.id));
  for(const id of allowedEmailSuggestionIds){if(typeof id==='string' && (isEmailFixtureSuggestion({id,source:'email',rule:'email_to_task'}) || isLifeFixtureSuggestion({id,source:'school',rule:'school_to_task'}) || isLifeFixtureSuggestion({id,source:'household',rule:'household_to_task'})))known.add(id);}
  return new Set((Array.isArray(rows)?rows:[])
    .filter(r=>r?.owner_id===ownerId && r.visibility==='private' && r.item_type==='suggestion_decision'
      && r.payload?.fictional===true && r.payload?.status==='dismissed' && known.has(r.payload?.suggestion_id))
    .map(r=>r.payload.suggestion_id));
}
