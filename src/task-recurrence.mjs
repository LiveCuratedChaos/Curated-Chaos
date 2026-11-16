// Civil-date scheduling only: no clock, timers, storage, record changes or provider calls.
const frequencies=['daily','weekly','monthly','yearly'],maxOrdinal=37000,dayMs=86400000;
function day(value){if(typeof value!=='string'||!/^(?:20\d{2}|2100)-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Choose a real date between 2000 and 2100.');return value;}
export function validateTaskRecurrence(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='anchorDay,frequency,interval'||!frequencies.includes(value.frequency)||!Number.isInteger(value.interval)||value.interval<1||value.interval>365)throw Error('Use an anchored daily, weekly, monthly or yearly schedule with interval 1–365.');
 return{anchorDay:day(value.anchorDay),frequency:value.frequency,interval:value.interval};
}
function occurrence(schedule,ordinal){
 const {anchorDay,frequency,interval}=schedule,[year,month,date]=anchorDay.split('-').map(Number);let result;
 if(frequency==='daily'||frequency==='weekly')result=new Date(Date.parse(anchorDay+'T00:00:00Z')+ordinal*interval*(frequency==='weekly'?7:1)*dayMs);
 else{const months=(year*12+month-1)+ordinal*interval*(frequency==='yearly'?12:1),nextYear=Math.floor(months/12),nextMonth=months%12;if(nextYear>2100)return null;const last=new Date(Date.UTC(nextYear,nextMonth+1,0)).getUTCDate();result=new Date(Date.UTC(nextYear,nextMonth,Math.min(date,last)));}
 if(result.getUTCFullYear()>2100)return null;return result.toISOString().slice(0,10);
}
// First occurrence strictly after cutoff. The bounded binary search also handles
// decades of missed dates without generating a backlog or a long-running loop.
function firstAfter(schedule,cutoff){let low=0,high=maxOrdinal;while(low<high){const middle=Math.floor((low+high)/2),candidate=occurrence(schedule,middle);if(candidate!==null&&candidate<=cutoff)low=middle+1;else high=middle;}return low;}
export function nextTaskOccurrence({schedule,currentDueDay,completedOn}={}){
 const canonical=validateTaskRecurrence(schedule);day(currentDueDay);day(completedOn);
 const previous=firstAfter(canonical,currentDueDay)-1;if(previous<0||occurrence(canonical,previous)!==currentDueDay)throw Error('The current due date does not match the original schedule. Review the schedule before continuing.');
 const ordinal=firstAfter(canonical,currentDueDay>completedOn?currentDueDay:completedOn),next=occurrence(canonical,ordinal);if(!next)throw Error('The next scheduled date is beyond 2100. Review the schedule.');
 return{day:next,ordinal,skippedOccurrences:ordinal-previous-1,schedule:canonical};
}
