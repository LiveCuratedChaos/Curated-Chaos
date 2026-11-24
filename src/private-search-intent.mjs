// Bounded English read filters only. No network, AI, history or record changes.
import {newYorkTaskDay} from './private-smart-task.mjs';
import {validSavedSearchFilters} from './private-saved-search-panel.mjs';
const millisecondsPerDay=86400000;
const friendly='This search could not be interpreted. Use explicit filters or a supported phrase.';
const fail=()=>{throw Error(friendly);};
const day=value=>typeof value==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const format=value=>new Date(value).toISOString().slice(0,10);
const singleDay='(?:today|tomorrow|yesterday|\\d{4}-\\d{2}-\\d{2})';
const intervalPhrase='(?:between\\s+'+singleDay+'\\s+and\\s+'+singleDay+'|from\\s+'+singleDay+'\\s+(?:through|to)\\s+'+singleDay+')';
const intervalPattern=new RegExp('^'+intervalPhrase+'$','i');
const datePhrase='(?:'+singleDay+'|this\\s+week|next\\s+week|this\\s+month|next\\s+month|'+intervalPhrase+')';
const completeDate=new RegExp('^(?:(?:due|on)\\s+)?('+datePhrase+')$','i');
const trailingDate=new RegExp('(?:^|\\s)(?:(due|on)\\s+)?('+datePhrase+')$','i');
// Reserved filter language in an unquoted title would have two meanings. A
// quoted `about` phrase deliberately remains literal, including these words.
const reserved=/\b(?:show|find|open|completed|all|overdue|home|personal\s+life|work|school|low|normal|high|urgent|priority|tasks?|events?|notes?|projects?|today|tomorrow|yesterday|this|next|last|days?|weeks?|months?|years?|date|dated|due|on|by|before|after|between|until|since|in|without|not|except|excluding|but|and|or|active|done|finished|unfinished|sunday|monday|tuesday|wednesday|thursday|friday|saturday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
function dates(phrase,anchor,weekStart){
 const normalized=phrase.toLowerCase().replace(/\s+/g,' '),timestamp=Date.parse(anchor+'T00:00:00Z');let from,to;
 if(intervalPattern.test(normalized)){
  const [,first,,last]=normalized.split(' ');
  const from=dates(first,anchor,weekStart).dateFrom,to=dates(last,anchor,weekStart).dateTo;
  if(from>to)fail();
  return {dateFrom:from,dateTo:to};
 }
 if(day(normalized)){from=normalized;to=normalized;}
 else if(['today','tomorrow','yesterday'].includes(normalized)){from=format(timestamp+({today:0,tomorrow:1,yesterday:-1}[normalized])*millisecondsPerDay);to=from;}
 else if(['this week','next week'].includes(normalized)){const first=timestamp-((new Date(timestamp).getUTCDay()-weekStart+7)%7)*millisecondsPerDay+(normalized==='next week'?7*millisecondsPerDay:0);from=format(first);to=format(first+6*millisecondsPerDay);}
 else if(['this month','next month'].includes(normalized)){const first=new Date(anchor.slice(0,7)+'-01T00:00:00Z');if(normalized==='next month')first.setUTCMonth(first.getUTCMonth()+1);from=format(first.getTime());first.setUTCMonth(first.getUTCMonth()+1);to=format(first.getTime()-millisecondsPerDay);}
 else fail();
 if(!day(from)||!day(to))fail();return{dateFrom:from,dateTo:to};
}
export function parsePrivateSearchIntent(text,options={}){
 try{
  if(!options||typeof options!=='object'||Array.isArray(options))fail();
  const {now=Date.now(),allowProjects=false,allowSchoolRead=false,allowPriority=false,allowDates=false,allowUndated=false,weekStart=0}=options;
  if(!Number.isFinite(now)||[allowProjects,allowSchoolRead,allowPriority,allowDates,allowUndated].some(value=>typeof value!=='boolean')||!Number.isInteger(weekStart)||weekStart<0||weekStart>6||typeof text!=='string'||!text.trim()||text.length>300||/[\u0000-\u001f\u007f]/.test(text))fail();
  const anchorDay=newYorkTaskDay(now);if(!day(anchorDay))fail();
  let remaining=text.trim(),type,status,section,priority,overdue=false;
  const leading=remaining.match(/^(?:show|find)\b\s*/i);if(leading)remaining=remaining.slice(leading[0].length);
  while(remaining){
   const schoolRecords=remaining.match(/^school\s+records?\b\s*/i);
   if(schoolRecords){
    if(!allowSchoolRead||section!==undefined)fail();
    type='school';section='School';remaining=remaining.slice(schoolRecords[0].length).trim();break;
   }
   const record=remaining.match(/^(tasks?|events?|notes?|projects?)\b\s*/i);
   if(record){type=record[1].toLowerCase().replace(/s$/,'');remaining=remaining.slice(record[0].length).trim();break;}
   const personal=remaining.match(/^personal\s+life\b\s*/i),word=remaining.match(/^([a-z]+)\b\s*/i);if(!word)fail();
   const lower=word[1].toLowerCase();
   if(personal||['home','work','school'].includes(lower)){if(section!==undefined)fail();section=personal?'Personal Life':({home:'Home',work:'Work',school:'School'}[lower]);remaining=remaining.slice((personal??word)[0].length);}
   else if(['open','completed','all','overdue'].includes(lower)){if(status!==undefined)fail();status=lower==='overdue'?'open':lower;overdue=lower==='overdue';remaining=remaining.slice(word[0].length);}
   else if(['low','normal','high','urgent'].includes(lower)){if(priority!==undefined)fail();priority=lower[0].toUpperCase()+lower.slice(1);remaining=remaining.slice(word[0].length).replace(/^priority\b\s*/i,'');}
   else fail();
  }
  if(!type||type==='project'&&!allowProjects||priority!==undefined&&!allowPriority||type!=='task'&&(status!==undefined&&status!=='all'||priority!==undefined||overdue)||type==='event'&&section!==undefined||type==='note'&&section!==undefined&&section!=='Personal Life')fail();
  const fields={query:'',type,section:type==='event'?'Calendar':section??'all',status:status??'all',...(allowPriority?{priority:priority??'all'}:{}),...(allowDates?{dateFrom:'',dateTo:''}:{}),...(allowUndated?{dateStatus:'all'}:{})};
  let dateCondition=null,undated=false,titleText=remaining;
  if(/^about\s+"/i.test(remaining)){
   const quoted=remaining.match(/^about\s+"([^"\\]*)"(?:\s+(.*))?$/i);if(!quoted||!quoted[1].trim())fail();fields.query=quoted[1].trim();titleText='';const trailing=quoted[2]?.trim()??'';
   if(trailing){const match=trailing.match(completeDate);if(match)dateCondition=match[1];else if(/^without\s+(?:a\s+)?due\s+date$/i.test(trailing))undated=true;else fail();}
  }else{
   if(remaining.includes('"'))fail();
   const without=remaining.match(/(?:^|\s)without\s+(?:a\s+)?due\s+date$/i);
   if(without){undated=true;titleText=remaining.slice(0,without.index).trim();}
   else{
    const complete=remaining.match(completeDate),trailing=remaining.match(trailingDate);
    if(complete){dateCondition=complete[1];titleText='';}
    else if(trailing){if(!trailing[1]&&!intervalPattern.test(trailing[2]))fail();dateCondition=trailing[2];titleText=remaining.slice(0,trailing.index).trim();}
   }
   if(titleText){titleText=titleText.replace(/^about\b\s*/i,'');if(!titleText.trim()||reserved.test(titleText)||/\d{1,4}[-/]\d{1,2}/.test(titleText))fail();fields.query=titleText.trim();}
  }
  if(fields.query.length>100||overdue&&(dateCondition!==null||undated)||dateCondition!==null&&undated)fail();
  if(undated){if(type!=='task'||!allowUndated)fail();fields.dateStatus='undated';}
  if(dateCondition!==null){if(!allowDates||!['task','event'].includes(type))fail();Object.assign(fields,dates(dateCondition,anchorDay,weekStart));}
  if(overdue){if(!allowDates)fail();const yesterday=format(Date.parse(anchorDay+'T00:00:00Z')-millisecondsPerDay);if(!day(yesterday))fail();fields.dateTo=yesterday;}
  if(!validSavedSearchFilters({priority:'all',dateFrom:'',dateTo:'',dateStatus:'all',...fields}))fail();
  return{fields,anchorDay,interpretedAt:now,expiresAt:now+300000};
 }catch{throw Error(friendly);}
}
