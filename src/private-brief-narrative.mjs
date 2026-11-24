// A local presentation of verified current-record counts and optional titles.
// Returns plain text, never HTML, actions, record identities or provider content.
import {verifyPrivateSchoolOverview} from './private-school-read.mjs';
import {validateBriefLayout} from './private-brief-layout.mjs';
import {verifyPrivateProjectOverview} from './private-project-overview.mjs';
const coreSections=['dueTasks','upcomingTasks','undatedTasks','completedTasks','eventsToday','upcomingEvents','notes'];
const count=value=>Number.isInteger(value)&&value>=0&&value<=2000;
const day=value=>typeof value==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const title=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value);
const noun=(number,singular)=>singular+(number===1?'':'s'),is=number=>number===1?'is':'are';
const fail=()=>{throw Error('Current saved-record summary unavailable.');};
function checkedCore(brief,now){
 const checked=typeof brief?.checkedAt==='string'?Date.parse(brief.checkedAt):NaN,c=brief?.counts;
 if(!brief||Array.isArray(brief)||!Number.isFinite(now)||!day(brief.day)||!Number.isFinite(checked)||new Date(checked).toISOString()!==brief.checkedAt||checked>now||checked<now-300000||!Number.isFinite(brief.expiresAt)||brief.expiresAt<=now||brief.providerRead!==false||!(brief.readOnly===true||brief.readOnly===false&&brief.taskCompletionAvailable===true)||brief.currentRecords!==undefined&&brief.currentRecords!==true||brief.selectedDate!==undefined&&(brief.selectedDate!==true||brief.currentRecords!==true)||!c||Array.isArray(c)||!['sourceRecords','supportedRecords','omittedRecords'].every(key=>count(c[key])))fail();
 const undated=Object.hasOwn(c,'undatedTasks')||Object.hasOwn(brief,'undatedTasks');let supported=0;
 for(const id of coreSections){
  if(id==='undatedTasks'&&!undated)continue;
  const rows=brief[id],total=c[id];
  if(!count(total)||!Array.isArray(rows)||rows.length!==Math.min(20,total))fail();
  for(const row of rows){
   if(!row||Array.isArray(row)||!title(row.title))fail();
   if(id.endsWith('Tasks')&&(!['Home','Personal Life','Work','School'].includes(row.section)||typeof row.day!=='string'||row.day!==''&&!day(row.day)))fail();
   if(id==='dueTasks'&&(!row.day||row.day>brief.day)||id==='upcomingTasks'&&(!row.day||row.day<=brief.day)||id==='undatedTasks'&&row.day!=='')fail();
   if(id==='eventsToday'&&row.day!==undefined&&(!day(row.day)||row.day>brief.day)||id==='upcomingEvents'&&(!day(row.day)||row.day<=brief.day))fail();
  }
  supported+=total;
 }
 // Past workspace events remain supported records but do not belong to either
 // the selected-day overlap list or the future-start list.
 if(supported>c.supportedRecords||c.supportedRecords+c.omittedRecords!==c.sourceRecords)fail();
 const expiresAt=Math.min(brief.expiresAt,checked+300000);if(expiresAt<=now)fail();
 return{checkedAt:brief.checkedAt,expiresAt,undated};
}
function coreFact(id,number,date){
 switch(id){
  case'dueTasks':return`There ${is(number)} ${number} open ${noun(number,'task')} due on or before ${date}.`;
  case'upcomingTasks':return`There ${is(number)} ${number} open ${noun(number,'task')} dated after ${date}.`;
  case'undatedTasks':return`There ${is(number)} ${number} open ${noun(number,'task')} without a due date.`;
  case'completedTasks':return`${number} ${noun(number,'task')} ${is(number)} currently marked complete.`;
  case'eventsToday':return`${number} saved workspace ${noun(number,'event')} ${number===1?'overlaps':'overlap'} ${date}.`;
  case'upcomingEvents':return`${number} saved workspace ${noun(number,'event')} ${number===1?'starts':'start'} after ${date}.`;
  case'notes':return`${number} saved ${noun(number,'note')} ${is(number)} included in this Brief.`;
  default:fail();
 }
}
export function generateBriefNarrative(brief,layout,options={}){
 try{
  if(!options||typeof options!=='object'||Array.isArray(options))fail();const now=options.now===undefined?Date.now():options.now;
  const preferences=validateBriefLayout(layout),fresh=checkedCore(brief,now),facts=[];
  for(const section of preferences.sections){
   if(section.display!=='expanded'||section.id==='bills'||section.id==='undatedTasks'&&!fresh.undated)continue;
   if(section.id==='school'){
    const school=brief.schoolOverview;if(school==null||school.available===false&&Object.keys(school).length===1)continue;verifyPrivateSchoolOverview(school,{now});const completed=school.courses.filter(course=>course.status==='Completed').length;facts.push({text:`${school.programs.length} saved ${noun(school.programs.length,'program')} and ${school.courses.length} saved ${noun(school.courses.length,'course')} are currently shown; ${completed} ${noun(completed,'course')} ${is(completed)} currently marked complete.`,titles:school.courses.map(course=>course.title),expiresAt:school.expiresAt});
   }else if(section.id==='routines'){
    const routines=brief.routines;
    if(routines==null)continue;
    const {count:total,completed,rows}=routines;
    if(!count(total)||total>brief.counts.supportedRecords||!count(completed)||completed>total||
       !Array.isArray(rows)||rows.length!==Math.min(20,total)||
       rows.some(row=>!row||!title(row.title)||typeof row.done!=='boolean'))fail();
    const shownComplete=rows.filter(row=>row.done).length;
    if(shownComplete>completed||rows.length-shownComplete>total-completed)fail();
    // These are also task records. The breakdown does not add to the task totals.
    facts.push({text:`${total} saved ${noun(total,'routine')} scheduled for ${brief.day}: ${total-completed} due and ${completed} complete.`,titles:[]});
   }else if(section.id==='projects'){
    if(brief.projectOverview==null)continue;
    const projects=verifyPrivateProjectOverview(brief.projectOverview,{now});if(!projects.available)continue;
    facts.push({text:`${projects.totalCount} ${noun(projects.totalCount,'project')} ${is(projects.totalCount)} currently saved: ${projects.openCount} open and ${projects.completedCount} marked complete.`,titles:projects.projects.map(row=>row.title),expiresAt:projects.expiresAt});
   }else facts.push({text:coreFact(section.id,brief.counts[section.id],brief.day),titles:brief[section.id].map(row=>row.title)});
  }
  const settings=preferences.narrative,limits={short:2,standard:4,detailed:10},titlesPerSection={short:1,standard:2,detailed:3},shown=facts.slice(0,limits[settings.length]);
  const introductions={'elegant-warm':`A glimpse of your current saved records for ${brief.day}.`,professional:`Current saved-record summary for ${brief.day}.`,gentle:`Here is a look at your current saved records for ${brief.day}.`};
  const paragraphs=[introductions[settings.tone]+' This reflects current supported records, not a historical snapshot.'];
  for(const fact of shown){let paragraph=fact.text;if(settings.detail==='titles'&&fact.titles.length)paragraph+=' Shown titles: '+fact.titles.slice(0,titlesPerSection[settings.length]).map(value=>'“'+value+'”').join('; ')+'.';paragraphs.push(paragraph);}
  if(facts.length>shown.length)paragraphs.push('Additional expanded sections are shown below.');
  if(!facts.length)paragraphs.push('No expanded sections with verified saved-record information are selected for this summary.');
  return{available:true,checkedAt:fresh.checkedAt,expiresAt:Math.min(fresh.expiresAt,...shown.filter(fact=>fact.expiresAt!==undefined).map(fact=>fact.expiresAt)),paragraphs};
 }catch{return{available:false};}
}
