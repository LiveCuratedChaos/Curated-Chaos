// Verify current saved-project input; never invent dates or task/progress totals.
import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
import {PROJECT_AREAS,PROJECT_STATUSES} from './private-project-model.mjs';
const keys=['available','totalCount','openCount','completedCount','omittedOpenCount','checkedAt','expiresAt','projects'];
const rowKeys=['type','title','section','projectStatus','projectReadToken','homeAssetSummary'];
const baseRowKeys=rowKeys.slice(0,5);
const validSummaryDay=value=>{if(typeof value!=='string'||value!==''&&!/^\d{4}-\d\d-\d\d$/.test(value))return false;if(!value)return true;const [y,m,d]=value.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d));return y>=2000&&y<=2100&&day.getUTCFullYear()===y&&day.getUTCMonth()+1===m&&day.getUTCDate()===d;};
const validHomeAssetSummary=value=>exact(value,['kind','label','usageUnit','latestUsageDay','latestUsageValue','warrantyEndDay'])&&['possession','vehicle'].includes(value.kind)&&typeof value.label==='string'&&value.label===value.label.trim()&&value.label.length<=190&&!/[\u0000-\u001f\u007f]/.test(value.label)&&['miles','hours','cycles'].includes(value.usageUnit)&&(value.kind!=='vehicle'||value.usageUnit==='miles')&&(value.kind!=='possession'||value.usageUnit!=='miles')&&validSummaryDay(value.latestUsageDay)&&(value.latestUsageValue===null&&value.latestUsageDay===''||Number.isSafeInteger(value.latestUsageValue)&&value.latestUsageValue>=0&&value.latestUsageDay!=='')&&validSummaryDay(value.warrantyEndDay);
const validRow=(row,area=null)=>{const keys=Object.hasOwn(row??{},'homeAssetSummary')?[...baseRowKeys,'homeAssetSummary']:baseRowKeys;return exact(row,Object.hasOwn(row??{},'displayColor')?[...keys,'displayColor']:keys)&&(!Object.hasOwn(row,'displayColor')||CATEGORY_COLOR_TOKENS.includes(row.displayColor))&&row.type==='project'&&title(row.title)&&PROJECT_AREAS.includes(row.section)&&(area===null||area==='all'||row.section===area)&&PROJECT_STATUSES.includes(row.projectStatus)&&row.projectStatus!=='Completed'&&token(row.projectReadToken)&&(!Object.hasOwn(row,'homeAssetSummary')||row.section==='Home'&&validHomeAssetSummary(row.homeAssetSummary));};
const exact=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===allowed.length&&Object.keys(value).every(key=>allowed.includes(key));
const count=value=>Number.isInteger(value)&&value>=0&&value<=2000;
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const title=value=>typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=140&&!/[\u0000-\u001f\u007f]/.test(value);
export function verifyPrivateProjectOverview(value,{now=Date.now()}={}){
 if(exact(value,['available'])&&value.available===false)return value;
 const checked=typeof value?.checkedAt==='string'?Date.parse(value.checkedAt):NaN;
 if(!Number.isFinite(now)||!exact(value,Object.hasOwn(value??{},'widgetProjects')?[...keys,'widgetProjects']:keys)||value.available!==true||!['totalCount','openCount','completedCount','omittedOpenCount'].every(key=>count(value[key]))||value.openCount+value.completedCount!==value.totalCount||!Array.isArray(value.projects)||value.projects.length!==Math.min(5,value.openCount)||value.omittedOpenCount!==value.openCount-value.projects.length||!Number.isFinite(checked)||new Date(checked).toISOString()!==value.checkedAt||checked>now||checked<now-300000||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>checked+300000||new Set(value.projects.map(row=>row?.projectReadToken)).size!==value.projects.length||value.projects.some(row=>!validRow(row)))throw Error('Current saved projects could not be verified. Fetch latest before opening them.');
 if(Object.hasOwn(value,'widgetProjects'))verifyProjectWidgetBuckets(value);
 return value;
}

function verifyProjectWidgetBuckets(value){
 const sources=value.widgetProjects,areas=['all',...PROJECT_AREAS],seen=new Map();
 if(!exact(sources,['schemaVersion','areas'])||sources.schemaVersion!==1||!exact(sources.areas,areas))throw Error('Complete saved project widget sources required.');
 for(const area of areas){const bucket=sources.areas[area];
  if(!exact(bucket,['openCount','completedCount','rows'])||!count(bucket.openCount)||!count(bucket.completedCount)||bucket.openCount+bucket.completedCount>2000||!Array.isArray(bucket.rows)||bucket.rows.length!==Math.min(10,bucket.openCount)||new Set(bucket.rows.map(row=>row?.projectReadToken)).size!==bucket.rows.length)throw Error('Complete bounded project area counts required.');
  for(const row of bucket.rows){if(!validRow(row,area))throw Error('Exact sparse project widget titles required.');const signature=JSON.stringify(row),prior=seen.get(row.projectReadToken);if(prior&&prior!==signature)throw Error('Project capability must identify one unchanged title.');seen.set(row.projectReadToken,signature);}
 }
 const all=sources.areas.all;if(all.openCount!==value.openCount||all.completedCount!==value.completedCount||PROJECT_AREAS.reduce((n,a)=>n+sources.areas[a].openCount,0)!==all.openCount||PROJECT_AREAS.reduce((n,a)=>n+sources.areas[a].completedCount,0)!==all.completedCount||seen.size>50||JSON.stringify(all.rows.slice(0,5))!==JSON.stringify(value.projects))throw Error('Project widget counts must match the complete original overview.');
}
