export const PROJECT_AREAS=Object.freeze(['Home','Personal Life','Work','School']);
export const PROJECT_STATUSES=Object.freeze(['Planned','Active','On hold','Completed']);
export const validProjectDay=value=>typeof value==='string'&&(value===''||/^(?:20\d\d|2100)-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value);
export function projectFields(value){
 if(value&&Object.hasOwn(value,'day')&&!validProjectDay(value.day))throw Error('Use a real project target date from 2000 through 2100, or leave it blank.');
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).filter(k=>!['separateRecurring','archived','day'].includes(k)).sort().join(',')!=='description,section,status,title'||Object.hasOwn(value,'day')&&!validProjectDay(value.day)||Object.hasOwn(value,'archived')&&typeof value.archived!=='boolean'||Object.hasOwn(value,'separateRecurring')&&typeof value.separateRecurring!=='boolean'||typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>140||/[\u0000-\u001f\u007f]/.test(value.title)||typeof value.description!=='string'||value.description.length>10000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.description)||!PROJECT_AREAS.includes(value.section)||!PROJECT_STATUSES.includes(value.status))throw Error('Use a project title up to 140 characters, details up to 10,000 characters, and supported area/status.');
 return{...(Object.hasOwn(value,'day')?{day:value.day}:{}),...(Object.hasOwn(value,'archived')?{archived:value.archived}:{}),title:value.title.trim(),description:value.description,section:value.section,status:value.status,...(Object.hasOwn(value,'separateRecurring')?{separateRecurring:value.separateRecurring}:{})};
}

// Display wording preserves existing saved and transported status values.
export function projectStatusLabel(status){return status==='Active'?'In Progress':status;}

// View preferences only; these fields never enter saved project payloads.
export function projectBrowseFields(value={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['query','section','status','dateMode','dateFrom','dateTo','sort'].includes(k)))throw Error('Choose supported project filters.');
 const fields={query:'',section:'all',status:'all',dateMode:'all',dateFrom:'',dateTo:'',sort:'title',...value};
 if(typeof fields.query!=='string'||fields.query.trim().length>100||!['all',...PROJECT_AREAS].includes(fields.section)||!['all','current','archived',...PROJECT_STATUSES].includes(fields.status)||!['all','dated','undated'].includes(fields.dateMode)||!['title','target-asc','target-desc'].includes(fields.sort)||!validProjectDay(fields.dateFrom)||!validProjectDay(fields.dateTo)||fields.dateFrom&&fields.dateTo&&fields.dateFrom>fields.dateTo||fields.dateMode==='undated'&&(fields.dateFrom||fields.dateTo))throw Error('Use supported project filters and real, ordered target dates from 2000 through 2100.');
 return{...fields,query:fields.query.trim()};
}
export function projectMatchesDates(day='',fields){return(fields.dateMode==='all'||Boolean(day)===(fields.dateMode==='dated'))&&(!(fields.dateFrom||fields.dateTo)||Boolean(day)&&(!fields.dateFrom||day>=fields.dateFrom)&&(!fields.dateTo||day<=fields.dateTo));}
export function compareProjectSummaries(a,b,sort='title'){
 const left=a.day??'',right=b.day??'';
 return(sort==='title'?0:!left&&right?1:left&&!right?-1:left&&right?(sort==='target-desc'?-1:1)*left.localeCompare(right):0)||a.title.localeCompare(b.title)||(a.id??'').localeCompare(b.id??'');
}
