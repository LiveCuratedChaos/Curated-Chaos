import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, applyDraft, applySuggestion, buildBrief, dayString, escapeHtml, initialSettings, isVisibleRecord, safeAutomationMode, seedDemoData, uniqueEvents, validateDraft } from '../src/core.mjs';
const day='2026-11-02';

test('calendar date arithmetic retains local YYYY-MM-DD', () => {
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(dayString(new Date(2026,9,29,12)),'2026-10-29');
});
test('fixture clearly marks fiction, and brief uses selected date',()=>{
  const data=seedDemoData(day), settings={...initialSettings(),selectedDate:day};
  assert.equal(data.sample,true);
  const brief=buildBrief(data,settings);
  assert.equal(brief.events.length,1);
  assert.equal(brief.tasks.length,3);
  assert.match(brief.summary,/fictional/i);
});
test('disabling calendar and email sources hides related info',()=>{
  const data=seedDemoData(day), settings={...initialSettings(),selectedDate:day};
  settings.sources.calendar=false; settings.sources.email=false;
  const brief=buildBrief(data,settings);
  assert.equal(brief.events.length,0);
  assert.equal(brief.pending.length,0);
});
test('household and school source filters apply to the summary as well as their sections',()=>{
  const data=seedDemoData(day), settings={...initialSettings(),selectedDate:day};
  settings.sources.household=false; settings.sources.school=false;
  const brief=buildBrief(data,settings);
  assert.equal(brief.householdTasks.length,0);
  assert.equal(brief.schoolTasks.length,0);
  assert.equal(brief.tasks.length,1);
});
test('different users cannot see personal records or ungranted household sections',()=>{
  const data=seedDemoData(day);
  const adult={userId:'fictional-other-adult',memberships:[{householdId:'fictional-household',active:true,role:'adult',readSections:[]}]};
  assert.equal(isVisibleRecord(data.tasks[0],adult),false);
  assert.equal(isVisibleRecord(data.tasks[2],adult),false);
  adult.memberships[0].readSections=['Home'];
  assert.equal(isVisibleRecord(data.tasks[2],adult),true);
  adult.memberships[0].active=false;
  assert.equal(isVisibleRecord(data.tasks[2],adult),false);
});
test('even an owner has no access to another adult private record',()=>{
  const data=seedDemoData(day);
  const privateOther={...data.tasks[0],ownerId:'another-adult'};
  assert.equal(isVisibleRecord(privateOther,data.viewer),false);
});
test('email-derived events and tasks always require review even if preference automatic',()=>{
  assert.equal(safeAutomationMode('email_to_event','automatic'),'ask');
  assert.equal(safeAutomationMode('email_to_task','automatic'),'ask');
  assert.equal(safeAutomationMode('permission_escalation','automatic'),'ask');
  assert.equal(safeAutomationMode('routine_categorization','automatic'),'automatic');
});
test('approving a suggestion creates event only on explicit invocation',()=>{
  const data=seedDemoData(day), priorCount=data.events.length;
  assert.equal(data.events.length,priorCount);
  const approved=applySuggestion(data,'suggest-1');
  assert.equal(approved.events.length,priorCount+1);
  assert.equal(data.suggestions[0].status,'pending');
  assert.equal(approved.suggestions[0].status,'approved');
});
test('approving the same suggestion twice is forbidden',()=>{
  const once=applySuggestion(seedDemoData(day),'suggest-1');
  assert.throws(()=>applySuggestion(once,'suggest-1'),/unavailable/);
});
test('duplicate event is never silently created',()=>{
  const data=seedDemoData(day);
  data.events.push({ ...data.events[0], id:'copy', title:'Sample video appointment',day:addDays(day,1),time:'15:00' });
  assert.throws(()=>applySuggestion(data,'suggest-1'),/matching event/);
  assert.equal(uniqueEvents([data.events[0],{...data.events[0],id:'copy2'}]).length,1);
});
test('manual entries are private by default and validated',()=>{
  const data=seedDemoData(day);
  assert.match(validateDraft({type:'task',title:'  ',day}),/title/);
  const updated=applyDraft(data,{type:'task',title:'Practice task',day,section:'School'},'manual-1');
  assert.equal(updated.tasks.at(-1).visibility,'private');
  assert.equal(updated.tasks.at(-1).section,'School');
});
test('untrusted content is escaped for UI',()=>{
  assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;');
});
