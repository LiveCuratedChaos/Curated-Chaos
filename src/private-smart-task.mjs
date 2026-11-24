// Deterministic local parsing only. No network, history, provider reads or mutations.
import {validDay} from './dev-brief-model.mjs';
import {TASK_PRIORITIES} from './task-priorities.mjs';
import {TASK_SECTIONS} from './dev-brief-model.mjs';
const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export function newYorkTaskDay(now=Date.now()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)),part=type=>parts.find(p=>p.type===type).value;
 return part('year')+'-'+part('month')+'-'+part('day');
}
export function parseSmartTask(text,{today}={}){
 if(typeof text!=='string'||!text.trim()||text.length>500||/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Error('Enter one task, up to 500 characters.');
 if(typeof today!=='string'||!validDay(today))throw Error('The New York date could not be verified. Use the regular task editor.');
 let title=text.trim(),day='',priority='Normal',section,dateSeen=false,prioritySeen=false,sectionSeen=false;
 function addDays(n){const result=new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);if(!validDay(result))throw Error('The interpreted date must be between 2000 and 2100.');return result;}
 for(let pass=0;pass<4;pass++){
  const priorityMatch=title.match(/(?:^|\s+)priority(?:\s*:\s*|\s+)(low|normal|high|urgent)\s*$/i);
  if(priorityMatch){if(prioritySeen)throw Error('Use just one priority phrase.');prioritySeen=true;priority=TASK_PRIORITIES.find(value=>value.toLowerCase()===priorityMatch[1].toLowerCase());title=title.slice(0,priorityMatch.index).trimEnd();continue;}
  const sectionMatch=title.match(/(?:^|\s+)(?:area\s*:\s*|in\s+)(Home|Personal\s+Life|Work|School)\s*$/i);
  if(sectionMatch){if(sectionSeen)throw Error('Use just one task area phrase.');sectionSeen=true;section=TASK_SECTIONS.find(value=>value.toLowerCase()===sectionMatch[1].replace(/\s+/g,' ').toLowerCase());title=title.slice(0,sectionMatch.index).trimEnd();continue;}
  const dateMatch=title.match(/(?:^|\s+)due(?:\s*:\s*|\s+)(today|tomorrow|none|in\s+\d{1,4}\s+days?|next\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|\d{4}-\d{2}-\d{2})\s*$/i);
  if(!dateMatch)break;if(dateSeen)throw Error('Use just one due-date phrase.');dateSeen=true;const phrase=dateMatch[1].toLowerCase().replace(/\s+/g,' ');
  if(phrase==='none')day='';else if(phrase==='today')day=today;else if(phrase==='tomorrow')day=addDays(1);else if(phrase.startsWith('in ')){const n=Number(phrase.split(' ')[1]);if(n>366)throw Error('Use a relative date from today through 366 days ahead.');day=addDays(n);}else if(phrase.startsWith('next ')){const target=weekdays.indexOf(phrase.slice(5)),current=new Date(today+'T00:00:00Z').getUTCDay();day=addDays((target-current+7)%7||7);}else{if(!validDay(phrase))throw Error('Choose a real due date between 2000 and 2100.');day=phrase;}
  title=title.slice(0,dateMatch.index).trimEnd();
 }
 if(/\b(?:due|priority|area)(?:\s|:)/i.test(title)||/\bin\s+(?:home|personal\s+life|work|school)\s*$/i.test(title))throw Error('That due-date, priority or task-area phrase was not recognized. Use the examples or the regular task editor.');
 if(!title||title.length>140)throw Error('The task title must contain 1–140 characters after the date and priority phrases.');
 return{title,day,priority,...(section?{section}:{})};
}

export function parseSmartTaskChecklist(text,{today}={}){
 if(typeof text!=='string'||!text.trim()||text.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Error('Enter one task and its bullet steps, up to 4000 characters.');
 const [header,...lines]=text.trim().replace(/\r\n?/g,'\n').split('\n');
 if(/^\s*[-*]\s+/.test(header))throw Error('Start with one task title, then put its bullet steps below.');
 const parsed=parseSmartTask(header,{today}),steps=[];
 for(const line of lines){if(!line.trim())continue;const match=line.trim().match(/^[-*]\s+(.+)$/);if(!match||/^\[[ xX]\]/.test(match[1]))throw Error('Use simple “- step” or “* step” lines. All new steps start open.');const title=match[1].trim();if(!title||title.length>140)throw Error('Each checklist step needs 1–140 characters.');steps.push(title);if(steps.length>20)throw Error('Use at most 20 checklist steps.');}
 return{...parsed,subtaskText:steps.join('\n')};
}
