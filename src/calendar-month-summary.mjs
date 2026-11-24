import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
// Bounded civil-date summaries. No record identifiers, details, credentials or I/O.
const day=v=>typeof v==='string'&&/^(?:20\d\d|2100)-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...expected].sort().join(',');
export function calendarMonthBounds(dateFrom){if(!day(dateFrom))throw Error('A supported month date is required.');const first=dateFrom.slice(0,7)+'-01',next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);return{first,last:new Date(next.getTime()-86400000).toISOString().slice(0,10)};}
function dates(first,last){return Array.from({length:Number(last.slice(8))},(_,i)=>first.slice(0,8)+String(i+1).padStart(2,'0'));}
const title=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
export function buildCalendarMonthSummary({dateFrom,dateTo='',events,incomplete=false}){
 const {first,last}=calendarMonthBounds(dateFrom);if(dateTo!==''&&(!day(dateTo)||dateTo<dateFrom)||typeof incomplete!=='boolean'||!Array.isArray(events)||events.length>2000||events.some(e=>!keys(e,['first','last','title',...(Object.hasOwn(e??{},'displayColor')?['displayColor']:[])])||Object.hasOwn(e,'displayColor')&&!CATEGORY_COLOR_TOKENS.includes(e.displayColor)||!day(e.first)||!day(e.last)||e.first>e.last||!title(e.title)||e.last<dateFrom||dateTo&&e.first>dateTo))throw Error('Complete bounded matching event intervals required.');
 return{version:1,first,last,matchingEvents:events.length,incomplete,days:dates(first,last).map(value=>{const matching=value>=dateFrom&&(!dateTo||value<=dateTo)?events.filter(e=>e.first<=value&&e.last>=value):[];return{day:value,count:matching.length,titles:matching.slice(0,2).map(e=>e.title),...(matching.slice(0,2).some(e=>e.displayColor)?{colors:matching.slice(0,2).map(e=>e.displayColor??null)}:{})};})};
}
export function verifyCalendarMonthSummary(value,{dateFrom,dateTo='',matchCount,incomplete,visibleEvents=[]}={}){
 const {first,last}=calendarMonthBounds(dateFrom),expected=dates(first,last);
 if(!keys(value,['version','first','last','matchingEvents','incomplete','days'])||value.version!==1||value.first!==first||value.last!==last||!Number.isInteger(matchCount)||matchCount<0||matchCount>2000||value.matchingEvents!==matchCount||typeof incomplete!=='boolean'||value.incomplete!==incomplete||!Array.isArray(value.days)||value.days.length!==expected.length)throw Error('Month summary could not be verified.');
 for(let i=0;i<expected.length;i++){const row=value.days[i],inRange=expected[i]>=dateFrom&&(!dateTo||expected[i]<=dateTo);if(!keys(row,['day','count','titles',...(Object.hasOwn(row??{},'colors')?['colors']:[])])||Object.hasOwn(row,'colors')&&(!Array.isArray(row.colors)||row.colors.length!==Math.min(2,row.count)||row.colors.some(v=>v!==null&&!CATEGORY_COLOR_TOKENS.includes(v)))||row.day!==expected[i]||!Number.isInteger(row.count)||row.count<0||row.count>matchCount||!Array.isArray(row.titles)||row.titles.length!==Math.min(2,row.count)||row.titles.some(t=>!title(t))||!inRange&&row.count!==0||row.count<visibleEvents.filter(e=>e.first<=row.day&&e.last>=row.day&&inRange).length)throw Error('Month day summary could not be verified.');}
 return value;
}
