/** Curated Chaos Milestone 0 — pure, dependency-free demo domain logic.
 * This module intentionally contains no network or provider functionality.
 */
export const AREAS = ['Home', 'Calendar', 'Personal Life', 'Work', 'School', 'Finances'];
export const SOURCE_KEYS = ['calendar', 'email', 'finance', 'tasks', 'school', 'household'];
export const AUTOMATION_OPTIONS = ['automatic', 'ask', 'disabled'];
export const FORCED_APPROVAL_RULES = new Set([
  'email_to_event', 'email_to_task', 'financial_record_update',
  'ownership_transfer', 'guardian_change', 'permission_escalation', 'account_deletion'
]);

export function dayString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date');
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function addDays(ymd, days) {
  const [y,m,d] = ymd.split('-').map(Number);
  return dayString(new Date(y, m-1, d+days, 12));
}
export function formatDate(ymd, options={}) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',weekday:'short', ...options}).format(new Date(y,m-1,d,12));
}
export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function sameEvent(a,b) {
  if (!a || !b) return false;
  const norm = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g,'');
  return a.day === b.day && norm(a.title) === norm(b.title);
}
export function safeAutomationMode(rule, configured='ask') {
  if (FORCED_APPROVAL_RULES.has(rule)) return 'ask';
  return AUTOMATION_OPTIONS.includes(configured) ? configured : 'ask';
}
export function isVisibleRecord(record, viewer) {
  if (!record || !viewer) return false;
  if (record.visibility === 'private') return record.ownerId === viewer.userId;
  if (record.visibility !== 'household' || !record.householdId) return false;
  const membership = (viewer.memberships || []).find(m => m.householdId === record.householdId && m.active);
  if (!membership) return false;
  if (membership.role === 'owner') return true;
  if (record.ownerId === viewer.userId) return true;
  return (membership.readSections || []).includes(record.section) || (membership.allowedRecordIds || []).includes(record.id);
}
export function visibleItems(items, viewer) { return items.filter(item => isVisibleRecord(item,viewer)); }
export function uniqueEvents(events) {
  const out=[];
  for (const event of events) if (!out.some(old => sameEvent(old,event))) out.push(event);
  return out;
}
export function initialSettings() {
  return {
    theme:'neutral',
    hideAmounts:true,
    selectedDate:dayString(),
    sources:Object.fromEntries(SOURCE_KEYS.map(k=>[k,true])),
    widgets:['schedule','priorities','school','bills','suggestions'],
    automation:{routine_categorization:'ask', email_to_event:'ask', email_to_task:'ask', financial_record_update:'ask'}
  };
}
export function seedDemoData(today=dayString()) {
  const ownerId='fictional-owner';
  const householdId='fictional-household';
  const personal = (id, section, other={}) => ({id,ownerId,section,visibility:'private',...other});
  const shared = (id,section,other={}) => ({id,ownerId,section,visibility:'household',householdId,...other});
  return {
    sample:true,
    viewer:{userId:ownerId,memberships:[{householdId,active:true,role:'owner',readSections:[]}]},
    events:[
      personal('event-1','Calendar',{title:'Sample project check-in',day:today,time:'10:00',origin:'Calendar sample'}),
      personal('event-2','Calendar',{title:'Sample appointment',day:addDays(today,1),time:'14:30',origin:'Calendar sample'}),
      shared('event-3','Calendar',{title:'Sample household planning',day:addDays(today,2),time:'18:00',origin:'Household sample'})
    ],
    tasks:[
      personal('task-1','Work',{title:'Review example project milestones',day:today,done:false,priority:'High'}),
      personal('task-2','School',{title:'Outline a practice school assignment',day:today,done:false,priority:'Medium'}),
      shared('task-3','Home',{title:'Pick up sample groceries',day:today,done:false,priority:'Normal'}),
      personal('task-4','Personal Life',{title:'Update a personal goal',day:addDays(today,2),done:false,priority:'Normal'})
    ],
    bills:[
      personal('bill-1','Finances',{title:'Example electricity bill',day:addDays(today,3),amount:84.25,paid:false}),
      personal('bill-2','Finances',{title:'Example internet bill',day:addDays(today,6),amount:49.95,paid:false})
    ],
    notes:[personal('note-1','Personal Life',{title:'Example reading list',body:'A fictional note for the development preview.'})],
    suggestions:[
      personal('suggest-1','Work',{title:'Add sample video appointment',description:'An example email indicates a video appointment tomorrow at 3:00 PM.',kind:'email_to_event',origin:'Email fixture',status:'pending',proposed:{type:'event',title:'Sample video appointment',day:addDays(today,1),time:'15:00',section:'Calendar'}}),
      personal('suggest-2','Work',{title:'Create example follow-up task',description:'A fictional email contains an action item requiring a reminder.',kind:'email_to_task',origin:'Email fixture',status:'pending',proposed:{type:'task',title:'Follow up on example message',day:addDays(today,1),section:'Work'}})
    ],
    account:{name:'Example Checking',balance:2450.90,source:'Financial fixture'},
    lastDemoAction:null
  };
}
export function buildBrief(data, settings, selectedDate=settings.selectedDate) {
  const viewer=data.viewer;
  const source=settings.sources;
  const includeArea = item => (item.visibility!=='household' || source.household) && (item.section!=='School' || source.school);
  const events=source.calendar ? uniqueEvents(visibleItems(data.events,viewer).filter(includeArea)).filter(e=>e.day===selectedDate).sort((a,b)=>a.time.localeCompare(b.time)) : [];
  const tasks=source.tasks ? visibleItems(data.tasks,viewer).filter(includeArea).filter(t=>!t.done && t.day<=selectedDate) : [];
  const bills=source.finance ? visibleItems(data.bills,viewer).filter(b=>!b.paid && b.day>=selectedDate && b.day<=addDays(selectedDate,7)).sort((a,b)=>a.day.localeCompare(b.day)) : [];
  const pending=source.email ? visibleItems(data.suggestions,viewer).filter(s=>s.status==='pending') : [];
  const schoolTasks=source.school ? tasks.filter(t=>t.section==='School') : [];
  const householdTasks=source.household ? tasks.filter(t=>t.visibility==='household') : [];
  const chunks=[];
  if (events.length) chunks.push(`${events.length} scheduled ${events.length===1?'event':'events'}`);
  if (tasks.length) chunks.push(`${tasks.length} open ${tasks.length===1?'task':'tasks'}`);
  if (bills.length) chunks.push(`${bills.length} upcoming ${bills.length===1?'bill':'bills'}`);
  if (pending.length) chunks.push(`${pending.length} ${pending.length===1?'suggestion':'suggestions'} to review`);
  const summary=chunks.length ? `Your fictional day includes ${chunks.join(', ')}. Everything here is sample information—not connected account data.` : 'There is nothing scheduled in the enabled fictional sources for this date. No real accounts are connected.';
  return { events, tasks, bills, pending, schoolTasks, householdTasks, summary };
}
export function validateDraft(draft) {
  const type=String(draft.type||'');
  const title=String(draft.title||'').trim();
  if (!['task','event','note','grocery'].includes(type)) return 'Choose a supported item type.';
  if (!title || title.length>140) return 'Enter a title between 1 and 140 characters.';
  if (['task','event','grocery'].includes(type) && !/^\d{4}-\d{2}-\d{2}$/.test(draft.day||'')) return 'Choose a valid date.';
  return null;
}
export function applyDraft(data,draft,id) {
  const err=validateDraft(draft);
  if (err) throw new Error(err);
  const base={ id, ownerId:data.viewer.userId, visibility:'private', title:draft.title.trim() };
  if (draft.type==='event') return {...data,events:[...data.events,{...base,section:'Calendar',day:draft.day,time:draft.time||'09:00',origin:'Manual demo'}]};
  if (draft.type==='note') return {...data,notes:[...data.notes,{...base,section:'Personal Life',body:draft.detail||''}]};
  const section=draft.type==='grocery'?'Home':(AREAS.includes(draft.section)?draft.section:'Personal Life');
  return {...data,tasks:[...data.tasks,{...base,section,day:draft.day,done:false,priority:'Normal'}]};
}
export function applySuggestion(data,id) {
  const suggestion=data.suggestions.find(s=>s.id===id && s.status==='pending');
  if (!suggestion || !isVisibleRecord(suggestion,data.viewer)) throw new Error('Suggestion unavailable');
  const proposed=suggestion.proposed;
  let next={...data,suggestions:data.suggestions.map(s=>s.id===id?{...s,status:'approved'}:s)};
  if (proposed.type==='event') {
    if (data.events.some(e=>isVisibleRecord(e,data.viewer)&&sameEvent(e,proposed))) throw new Error('A matching event already exists; review duplicates first.');
    next={...next,events:[...data.events,{id:`approved-${id}`,ownerId:data.viewer.userId,visibility:'private',title:proposed.title,section:'Calendar',day:proposed.day,time:proposed.time,origin:'Approved email suggestion'}]};
  } else if (proposed.type==='task') {
    next={...next,tasks:[...data.tasks,{id:`approved-${id}`,ownerId:data.viewer.userId,visibility:'private',section:proposed.section,title:proposed.title,day:proposed.day,done:false,priority:'Normal'}]};
  }
  return next;
}
