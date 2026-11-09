import {snapshotFreshness} from './snapshot-freshness.mjs';
// Read-only summary of already-authorized saved read models. No provider calls or actions.
function calendarDay(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function briefDateInZone(instant,timeZone='UTC'){
 if(!Number.isFinite(instant)||typeof timeZone!=='string'||timeZone.length>100)throw Error('Valid time and zone required.');
 try{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return parts.year.padStart(4,'0')+'-'+parts.month+'-'+parts.day;}catch{throw Error('Choose a supported time zone.');}
}
export function briefDayBounds(day,timeZone='UTC'){
 if(!calendarDay(day)||typeof timeZone!=='string'||timeZone.length>100)throw Error('Valid date and time zone required.');
 let format;try{format=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{throw Error('Choose a supported time zone.');}
 const dateAt=instant=>{const parts=Object.fromEntries(format.formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));return parts.year.padStart(4,'0')+'-'+parts.month+'-'+parts.day;};
 // Find the first instant at/after the date in this zone, including DST and skipped dates.
 function boundary(target){const center=Date.parse(target+'T00:00:00Z');let low=center-36*3600000,high=center+36*3600000;while(low<high){const mid=Math.floor((low+high)/2);if(dateAt(mid)<target)low=mid+1;else high=mid;}return low;}
 const start=boundary(day),next=new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10),end=boundary(next);if(dateAt(start)!==day||end<=start)throw Error('That local date does not exist in this time zone.');return{start,end};
}
export function savedSourceBrief({records,finance,day,timeZone='UTC',now=Date.now()}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day||!Array.isArray(records)||!Array.isArray(finance?.accounts)||!Array.isArray(finance?.transactions))throw Error('Valid saved sources and UTC day required.');
 const {start,end}=briefDayBounds(day,timeZone);
 // QA fixtures stay out of the real-source brief.
 const real=records.filter(r=>r.fictional===false);
 const events=real.filter(r=>['google_calendar','mac_calendar'].includes(r.provider)&&(r.allDay?r.startDate<=day&&r.endDateExclusive>day:Date.parse(r.start)<end&&Date.parse(r.end)>start)).map(r=>({provider:r.provider,...(r.provider==='mac_calendar'?{calendarTitle:r.calendarTitle}:{}),title:r.title,allDay:r.allDay,...(r.allDay?{startDate:r.startDate,endDateExclusive:r.endDateExclusive}:{start:r.start,end:r.end})}));
 const mail=real.filter(r=>r.provider==='gmail'&&Date.parse(r.receivedAt)<end).slice().sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt)).slice(0,5).map(r=>({title:r.title,receivedAt:r.receivedAt}));
 return {day,timeZone,freshness:snapshotFreshness({records,finance,now}),snapshot:true,providerRead:false,events,recentMail:mail,savedMailCount:real.filter(r=>r.provider==='gmail').length,financialAccounts:finance.accounts.filter(r=>r.fictional===false).length,financialTransactions:finance.transactions.filter(r=>r.fictional===false).length};
}
