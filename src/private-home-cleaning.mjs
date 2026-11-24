// Bounded per-task Home cleaning details. Room and assignee are display labels;
// rollover affects only which daily list shows an overdue task, never its date.
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const label=(value,max)=>typeof value==='string'&&value===value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const day=value=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return false;const [year,month,date]=value.split('-').map(Number),parsed=new Date(Date.UTC(year,month-1,date));return year>=2000&&year<=2100&&parsed.getUTCFullYear()===year&&parsed.getUTCMonth()+1===month&&parsed.getUTCDate()===date;};
export function normalizeHomeCleaning(value){
 if(!exact(value,['assignee','room','rollover'])||!label(value.room,80)||!label(value.assignee,80)||typeof value.rollover!=='boolean'||!value.room&&!value.assignee)throw Error('Cleaning details need a room or assignee and a rollover choice.');
 return{room:value.room,assignee:value.assignee,rollover:value.rollover};
}
export function readHomeCleaning(value){try{return normalizeHomeCleaning(value)}catch{return null}}
export function homeCleaningVisibleOnDay(task,day){
 const p=task?.payload,details=readHomeCleaning(p?.homeCleaning);
 if(!details||task.section!=='Home'||p.done!==false||!dayString(p.day)||!dayString(day))return false;
 return p.day===day||details.rollover&&p.day<day;
}
function dayString(value){return day(value);}
