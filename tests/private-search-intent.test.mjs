import test from 'node:test';import assert from 'node:assert/strict';
import {parsePrivateSearchIntent} from '../src/private-search-intent.mjs';
const now=Date.parse('2026-11-17T12:00:00.000Z'),options={now,allowProjects:true,allowPriority:true,allowDates:true,allowUndated:true,weekStart:0};
const parse=(text,extra={})=>parsePrivateSearchIntent(text,{...options,...extra});
const fields=patch=>({query:'',type:'task',section:'all',status:'all',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all',...patch});
test('supported intent examples produce exact reviewable filters and a five-minute New York interpretation',()=>{
 const cases=[['open work tasks due tomorrow',fields({section:'Work',status:'open',dateFrom:'2026-11-18',dateTo:'2026-11-18'})],['urgent school tasks',fields({section:'School',priority:'Urgent'})],['events this week',fields({type:'event',section:'Calendar',dateFrom:'2026-11-15',dateTo:'2026-11-21'})],['notes about "summer plans"',fields({type:'note',query:'summer plans'})],['projects about launch',fields({type:'project',query:'launch'})],['tasks without a due date',fields({dateStatus:'undated'})],['overdue tasks',fields({status:'open',dateTo:'2026-11-16'})]];
 for(const [text,expected]of cases)assert.deepEqual(parse(text),{fields:expected,anchorDay:'2026-11-17',interpretedAt:now,expiresAt:now+300000});
});
test('case-insensitive bounded modifiers and optional leading verbs preserve literal title case',()=>{
 assert.deepEqual(parse('FIND Completed Personal Life HIGH priority Tasks about Quarterly Plan due NEXT WEEK').fields,fields({query:'Quarterly Plan',section:'Personal Life',status:'completed',priority:'High',dateFrom:'2026-11-22',dateTo:'2026-11-28'}));assert.deepEqual(parse('show personal life notes about Summer Plan').fields,fields({query:'Summer Plan',type:'note',section:'Personal Life'}));assert.deepEqual(parse('all home task').fields,fields({section:'Home'}));assert.deepEqual(parse('normal work open task').fields,fields({section:'Work',status:'open',priority:'Normal'}));assert.deepEqual(parse('event on today').fields,fields({type:'event',section:'Calendar',dateFrom:'2026-11-17',dateTo:'2026-11-17'}));
});
test('quoted about phrases stay literal even when they contain filter grammar, dates or HTML-looking text',()=>{
 const query='open Work tasks due tomorrow and events';assert.deepEqual(parse('notes about "'+query+'"',{allowDates:false,allowPriority:false,allowUndated:false}).fields,{query,type:'note',section:'all',status:'all'});const hostile='<img src=x onerror=alert(1)>';assert.equal(parse('notes about "'+hostile+'"').fields.query,hostile);assert.deepEqual(parse('tasks about "Call Mom tomorrow" due today').fields,fields({query:'Call Mom tomorrow',dateFrom:'2026-11-17',dateTo:'2026-11-17'}));assert.equal(parse('tasks about "  Literal  Case  "').fields.query,'Literal  Case');
});
test('scope-dependent fields are present only when their feature flags permit them',()=>{
 assert.deepEqual(parsePrivateSearchIntent('open tasks',{now}).fields,{query:'',type:'task',section:'all',status:'open'});
 for(const allowPriority of [false,true])for(const allowDates of [false,true])for(const allowUndated of [false,true]){const value=parsePrivateSearchIntent('notes about Launch Plan',{now,allowPriority,allowDates,allowUndated}).fields;assert.deepEqual(Object.keys(value).sort(),['query','type','section','status',...(allowPriority?['priority']:[]),...(allowDates?['dateFrom','dateTo']:[]),...(allowUndated?['dateStatus']:[])].sort());}
 for(const [text,flag]of [['projects about launch','allowProjects'],['urgent tasks','allowPriority'],['tasks due today','allowDates'],['events this week','allowDates'],['overdue tasks','allowDates'],['tasks without a due date','allowUndated']])assert.throws(()=>parse(text,{[flag]:false}));
 assert.equal(parsePrivateSearchIntent('tasks without a due date',{now,allowUndated:true}).fields.dateStatus,'undated');
});
test('this and next calendar weeks honor every configured first weekday',()=>{
 const starts=['2026-11-15','2026-11-16','2026-11-17','2026-11-11','2026-11-12','2026-11-13','2026-11-14'];for(let weekStart=0;weekStart<7;weekStart++){const first=parse('tasks this week',{weekStart}).fields,next=parse('tasks next week',{weekStart}).fields;assert.equal(first.dateFrom,starts[weekStart]);assert.equal((Date.parse(first.dateTo)-Date.parse(first.dateFrom))/86400000,6);assert.equal((Date.parse(next.dateFrom)-Date.parse(first.dateFrom))/86400000,7);}assert.deepEqual(parse('events next week',{weekStart:1}).fields,fields({type:'event',section:'Calendar',dateFrom:'2026-11-23',dateTo:'2026-11-29'}));
});
test('relative dates and month ranges cross leap days and year boundaries with UTC civil arithmetic',()=>{
 assert.deepEqual(parse('tasks this month').fields,fields({dateFrom:'2026-11-01',dateTo:'2026-11-30'}));assert.deepEqual(parse('tasks next month').fields,fields({dateFrom:'2026-12-01',dateTo:'2026-12-31'}));assert.deepEqual(parse('tasks tomorrow',{now:Date.parse('2028-02-28T12:00:00Z')}).fields,fields({dateFrom:'2028-02-29',dateTo:'2028-02-29'}));assert.deepEqual(parse('tasks this month',{now:Date.parse('2100-02-17T12:00:00Z')}).fields,fields({dateFrom:'2100-02-01',dateTo:'2100-02-28'}));assert.deepEqual(parse('events this week',{now:Date.parse('2026-12-31T12:00:00Z'),weekStart:1}).fields,fields({type:'event',section:'Calendar',dateFrom:'2026-12-28',dateTo:'2027-01-03'}));assert.deepEqual(parse('tasks next month',{now:Date.parse('2026-12-31T12:00:00Z')}).fields,fields({dateFrom:'2027-01-01',dateTo:'2027-01-31'}));assert.deepEqual(parse('tasks on 2000-02-29').fields,fields({dateFrom:'2000-02-29',dateTo:'2000-02-29'}));
});
test('the interpretation anchor follows New York midnight and daylight-saving changes rather than UTC dates',()=>{
 const midnight=parse('tasks today',{now:Date.parse('2026-11-17T02:00:00Z')});assert.equal(midnight.anchorDay,'2026-11-16');assert.equal(midnight.fields.dateFrom,'2026-11-16');const spring=parse('tasks tomorrow',{now:Date.parse('2026-03-08T06:30:00Z')});assert.equal(spring.anchorDay,'2026-03-08');assert.equal(spring.fields.dateFrom,'2026-03-09');const before=parse('events this week',{now:Date.parse('2026-11-01T05:30:00Z')}),after=parse('events this week',{now:Date.parse('2026-11-01T06:30:00Z')});assert.equal(before.anchorDay,'2026-11-01');assert.deepEqual(before.fields,after.fields);
});
test('supported-range boundaries reject out-of-range dates and weeks without silent clipping',()=>{
 const lower=Date.parse('2000-01-01T12:00:00Z'),upper=Date.parse('2100-12-31T12:00:00Z');for(const text of ['tasks yesterday','overdue tasks','events this week'])assert.throws(()=>parse(text,{now:lower}));for(const text of ['tasks tomorrow','tasks next month','events this week','events next week'])assert.throws(()=>parse(text,{now:upper}));assert.equal(parse('events this week',{now:lower,weekStart:6}).fields.dateFrom,'2000-01-01');assert.equal(parse('events this week',{now:upper,weekStart:6}).fields.dateTo,'2100-12-31');for(const text of ['tasks on 1999-12-31','tasks on 2101-01-01','tasks on 2100-02-29','tasks on 2026-02-30','tasks 2026/11/17','tasks 2026-11-17T12:00:00Z'])assert.throws(()=>parse(text));
});
test('competing modifiers, dates, negation and unsupported grammar never silently widen the search',()=>{
 for(const text of ['open completed tasks','all open tasks','work home tasks','urgent high priority tasks','tasks due today on tomorrow','tasks today tomorrow','overdue tasks due today','overdue tasks without a due date','tasks without a due date without a due date','tasks not completed','tasks except school','tasks due soon','tasks next Friday','tasks by Monday','tasks before next month','tasks about Call Mom tomorrow','tasks about open ledger','tasks and notes','find show tasks','buy milk','show everything','all','find','tasks about','tasks "literal"','notes about "unfinished','notes about "foo" extra','notes about "foo" on today'])assert.throws(()=>parse(text));
});
test('non-task status, priority or undated constraints and unsupported area mappings are rejected',()=>{
 for(const text of ['open events','completed notes','completed projects','urgent events','normal notes','low priority projects','events without a due date','notes without a due date','projects without a due date','home events','school notes','work notes','notes today','projects next month'])assert.throws(()=>parse(text));assert.deepEqual(parse('all events').fields,fields({type:'event',section:'Calendar'}));
});
test('source, title and option bounds fail with one friendly error that never echoes input',()=>{
 const secret='PRIVATE_INPUT_NEVER_ECHO';for(const source of [null,{},[],true,42,'',' '.repeat(301),'notes about "'+'x'.repeat(101)+'"','notes about foo\nbar','notes about foo\u0000bar','find '+secret]){let error;try{parse(source);}catch(value){error=value;}assert.ok(error);assert.doesNotMatch(error.message,/PRIVATE_INPUT_NEVER_ECHO|foo|bar/);assert.match(error.message,/explicit filters|supported phrase/);}
 for(const extra of [{allowProjects:1},{allowPriority:'yes'},{allowDates:null},{allowUndated:0},{weekStart:-1},{weekStart:7},{weekStart:1.5},{weekStart:'0'},{weekStart:true},{now:NaN},{now:Infinity},{now:'today'},{now:false},{now:Date.parse('1999-12-31T12:00:00Z')}])assert.throws(()=>parse('tasks',extra));assert.throws(()=>parsePrivateSearchIntent('tasks',null));assert.throws(()=>parsePrivateSearchIntent('tasks',[]));
});

test('School record phrases propose the authorized program and course title filter',()=>{
 const scoped={allowSchoolRead:true};
 assert.deepEqual(parse('Find School records about Leadership',scoped).fields,fields({query:'Leadership',type:'school',section:'School'}));
 assert.deepEqual(parse('all school records',scoped).fields,fields({type:'school',section:'School'}));
 assert.equal(parse('School records about "work due tomorrow"',scoped).fields.query,'work due tomorrow');
 for(const phrase of ['work school records','school notes','completed School records','high priority school records','school records due tomorrow','school records without a due date','completed courses about math'])assert.throws(()=>parse(phrase,scoped));
 assert.throws(()=>parse('school records'));assert.throws(()=>parse('school records',{allowSchoolRead:1}));
 assert.deepEqual(parse('school tasks').fields,fields({section:'School'}));
});

test('inclusive task and event ranges preview exact dates and retain quoted title text',()=>{
 const range={dateFrom:'2026-11-17',dateTo:'2026-11-18'};
 assert.deepEqual(parse('open work tasks due between today and tomorrow').fields,fields({section:'Work',status:'open',...range}));
 assert.deepEqual(parse('events about "today and tomorrow" from 2026-11-17 through tomorrow').fields,fields({type:'event',section:'Calendar',query:'today and tomorrow',...range}));
 assert.deepEqual(parse('tasks about payroll from today to 2026-11-18').fields,fields({query:'payroll',...range}));
 assert.equal(parse('events between 2028-02-29 and 2028-02-29').fields.dateTo,'2028-02-29');
 for(const phrase of ['tasks from tomorrow through yesterday','events between 2026-02-29 and today','tasks from this week to next week','overdue tasks from today to tomorrow','notes from today to tomorrow','tasks due between today or tomorrow','tasks between today and tomorrow without a due date'])assert.throws(()=>parse(phrase));
 assert.throws(()=>parse('tasks between today and tomorrow',{allowDates:false}));
});

test('specific course and program phrases require authorized School reads',()=>{
 const opts={allowSchoolRead:true};
 assert.deepEqual(parse('find courses about leadership',opts).fields,fields({query:'leadership',type:'school-course',section:'School'}));
 assert.deepEqual(parse('find School programs about "work"',opts).fields,fields({query:'work',type:'school-program',section:'School'}));
 for(const phrase of ['School courses due tomorrow','open programs','home courses','programs without a due date'])assert.throws(()=>parse(phrase,opts));
 for(const phrase of ['courses','school courses','school programs','programs'])assert.throws(()=>parse(phrase));
});

test('one-sided dates compile strict and inclusive cutoffs to fixed civil days',()=>{
 for(const [phrase,bounds] of [
  ['open work tasks about payroll due by tomorrow',{dateTo:'2026-11-18'}],
  ['events about "on or after" on or after today',{dateFrom:'2026-11-17'}],
  ['tasks about payroll on or before yesterday',{dateTo:'2026-11-16'}],
  ['events before 2028-03-01',{dateTo:'2028-02-29'}],
  ['tasks after 2026-12-31',{dateFrom:'2027-01-01'}]
 ]){
  const parsed=parse(phrase).fields;
  assert.equal(parsed.dateFrom,bounds.dateFrom??'');
  assert.equal(parsed.dateTo,bounds.dateTo??'');
 }
 assert.equal(parse('tasks about "by tomorrow"').fields.query,'by tomorrow');
 for(const phrase of ['tasks before 2000-01-01','tasks after 2100-12-31','events by 2026-02-29','notes by tomorrow','overdue tasks after yesterday','tasks after yesterday before tomorrow','tasks by tomorrow without a due date'])assert.throws(()=>parse(phrase));
 assert.throws(()=>parse('tasks due by today',{allowDates:false}));
});


test('previous calendar periods use the configured week start and preserve month boundaries',()=>{
 assert.deepEqual(parse('completed work tasks due last week',{weekStart:1}).fields,
  fields({section:'Work',status:'completed',dateFrom:'2026-11-09',dateTo:'2026-11-15'}));
 assert.deepEqual(parse('events last week',{weekStart:0}).fields,
  fields({type:'event',section:'Calendar',dateFrom:'2026-11-08',dateTo:'2026-11-14'}));
 assert.deepEqual(parse('tasks about "last month" due last month',{now:Date.parse('2028-03-01T12:00:00Z')}).fields,
  fields({query:'last month',dateFrom:'2028-02-01',dateTo:'2028-02-29'}));
 assert.equal(parse('tasks last month',{now:Date.parse('2027-01-01T12:00:00Z')}).fields.dateFrom,'2026-12-01');
 assert.throws(()=>parse('tasks last month',{allowDates:false}));
 assert.throws(()=>parse('tasks last week',{now:Date.parse('2000-01-02T12:00:00Z')}));
});
