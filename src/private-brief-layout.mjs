// Presentation preferences only. Hidden sections never change record access.
export const BRIEF_SECTIONS=Object.freeze([
 {id:'dueTasks',label:'Due tasks'},
 {id:'upcomingTasks',label:'Upcoming tasks'},
 {id:'undatedTasks',label:'Tasks without a due date'},
 {id:'completedTasks',label:'Completed tasks'},
 {id:'eventsToday',label:'Today’s events'},
 {id:'upcomingEvents',label:'Upcoming events'},
 {id:'notes',label:'Notes'},
 {id:'projects',label:'Projects'},
 {id:'school',label:'School'}
].map(section=>Object.freeze(section)));
const defaultDateView=()=>({mode:'single',range:'rolling',weekStart:0});
const defaultNarrative=()=>({length:'standard',detail:'overview',tone:'elegant-warm'});
export function defaultBriefLayout(){return{schemaVersion:4,sections:BRIEF_SECTIONS.map(({id})=>({id,display:id==='school'?'hidden':id==='completedTasks'?'collapsed':'expanded'})),dateView:defaultDateView(),narrative:defaultNarrative()};}
export function validateBriefLayout(value){
 const fail=()=>{throw Error('Supported Brief section layout required.');};
 if(!value||typeof value!=='object'||Array.isArray(value)||![1,2,3,4].includes(value.schemaVersion)||Object.keys(value).sort().join(',')!==({1:'schemaVersion,sections',2:'dateView,schemaVersion,sections',3:'dateView,narrative,schemaVersion,sections',4:'dateView,narrative,schemaVersion,sections'}[value.schemaVersion])||!Array.isArray(value.sections)||value.sections.length!==(value.schemaVersion<4?8:9))fail();
 const seen=new Set(),sections=[];
 for(const section of value.sections){
  if(!section||typeof section!=='object'||Array.isArray(section)||Object.keys(section).sort().join(',')!=='display,id'||!BRIEF_SECTIONS.some(({id})=>id===section.id&&(value.schemaVersion===4||id!=='school'))||seen.has(section.id)||!['expanded','collapsed','hidden'].includes(section.display))fail();
  seen.add(section.id);sections.push({id:section.id,display:section.display});
 }
 if(value.schemaVersion<4)sections.push({id:'school',display:'hidden'});
 const dates=value.schemaVersion===1?defaultDateView():value.dateView;
 if(!dates||typeof dates!=='object'||Array.isArray(dates)||Object.keys(dates).sort().join(',')!=='mode,range,weekStart'||!['single','strip','week'].includes(dates.mode)||!['rolling','calendar'].includes(dates.range)||!Number.isInteger(dates.weekStart)||dates.weekStart<0||dates.weekStart>6)fail();
 const narrative=value.schemaVersion<3?defaultNarrative():value.narrative;
 if(!narrative||typeof narrative!=='object'||Array.isArray(narrative)||Object.keys(narrative).sort().join(',')!=='detail,length,tone'||!['short','standard','detailed'].includes(narrative.length)||!['overview','titles'].includes(narrative.detail)||!['elegant-warm','professional','gentle'].includes(narrative.tone))fail();
 return{schemaVersion:4,sections,dateView:{mode:dates.mode,range:dates.range,weekStart:dates.weekStart},narrative:{length:narrative.length,detail:narrative.detail,tone:narrative.tone}};
}
