import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';
import {validSavedSearchFilters} from './private-saved-search-panel.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const validDay=v=>typeof v==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function taskWorkspaceFields(){return{query:'',type:'task',section:'all',status:'open',priority:'all',dateFrom:'',dateTo:'',dateStatus:'all'};}
// Check the same bounded title-list response used by explicit task browsing.
export function verifyTaskWorkspaceList(result,fields,{now=Date.now(),offset=0}={}){
 const dateActive=Boolean(fields?.dateFrom||fields?.dateTo),rowKeys=['type','title','section','day','completed','priority','priorityUnavailable','displayColor','taskReadToken','editToken','completionToken','reopenToken','recordToken'];
 if(!validSavedSearchFilters(fields)||fields.type!=='task'||!Number.isFinite(now)||!Number.isInteger(offset)||offset<0||offset>1950||offset%50||!result||result.readOnly!==true||result.providerRead!==false||!Number.isFinite(Date.parse(result.checkedAt))||!Number.isFinite(result.expiresAt)||result.expiresAt<=now||result.limit!==50||result.offset!==offset||!Number.isInteger(result.matchCount)||result.matchCount<0||result.matchCount>2000||!Number.isInteger(result.omittedRecords)||result.omittedRecords<0||result.omittedRecords>2000||!Array.isArray(result.results)||result.results.length>50||result.results.length!==Math.min(50,Math.max(0,result.matchCount-offset))||offset>0&&offset>=result.matchCount||Object.keys(fields).some(k=>result[k]!==fields[k])||dateActive&&(!Number.isInteger(result.dateRangeUnavailableRecords)||result.dateRangeUnavailableRecords<0||result.dateRangeUnavailableRecords>2000))throw Error('The task list could not be verified. Fetch latest to try again.');
 if(result.results.some(row=>!row||Object.keys(row).some(k=>!rowKeys.includes(k))||Object.hasOwn(row,'displayColor')&&!CATEGORY_COLOR_TOKENS.includes(row.displayColor)||row.type!=='task'||typeof row.title!=='string'||!row.title.trim()||row.title.length>200||!['Home','Personal Life','Work','School'].includes(row.section)||typeof row.completed!=='boolean'||!(row.day===''||validDay(row.day))||fields.status!=='all'&&row.completed!==(fields.status==='completed')||fields.section!=='all'&&row.section!==fields.section||fields.dateStatus!=='all'&&Boolean(row.day)!==(fields.dateStatus==='dated')||dateActive&&(!row.day||fields.dateFrom&&row.day<fields.dateFrom||fields.dateTo&&row.day>fields.dateTo)||!(row.priorityUnavailable===true&&row.priority===undefined||['Low','Normal','High','Urgent'].includes(row.priority)&&row.priorityUnavailable===undefined)||fields.priority!=='all'&&row.priority!==fields.priority||['taskReadToken','editToken','completionToken','reopenToken','recordToken'].some(k=>Object.hasOwn(row,k)&&!token(row[k]))))throw Error('The task list contains unsupported display fields. Fetch latest to try again.');
 return result;
}

// Due-date views change only filters. Overdue always excludes completed/undated tasks.
export function taskDateShortcut(fields,action,{now=Date.now()}={}){
 if(!validSavedSearchFilters(fields)||fields.type!=='task')throw Error('Choose valid task filters before changing the date view.');
 const today=newYorkTaskDay(now);if(!validDay(today))throw Error('Choose a supported New York date.');
 const shift=n=>new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);let patch;
 if(action==='overdue')patch={status:'open',dateStatus:'dated',dateFrom:'',dateTo:shift(-1)};
 else if(action==='today')patch={dateStatus:'dated',dateFrom:today,dateTo:today};
 else if(action==='week')patch={dateStatus:'dated',dateFrom:today,dateTo:shift(6)};
 else if(action==='undated')patch={dateStatus:'undated',dateFrom:'',dateTo:''};
 else if(action==='all')patch={dateStatus:'all',dateFrom:'',dateTo:''};
 else throw Error('Choose a supported task date view.');
 const next={...fields,...patch};if(!validSavedSearchFilters(next))throw Error('Keep task dates between 2000 and 2100.');return next;
}

export function taskRescheduleDate(action,{now=Date.now()}={}){const today=newYorkTaskDay(now);if(!validDay(today))throw Error('A supported New York date is required.');if(action==='undated')return '';if(action!=='tomorrow')throw Error('Choose a supported task date action.');const next=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);if(!validDay(next))throw Error('Keep task dates between 2000 and 2100.');return next;}
