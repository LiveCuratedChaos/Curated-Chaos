import {isDocumentId} from './private-document-fields.mjs';
// Bounded Home possession and vehicle profile details stored on owner-private Home projects.
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const text=(value,max)=>typeof value==='string'&&value===value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const day=value=>{if(typeof value!=='string'||!/^(?:|\d{4}-\d\d-\d\d)$/.test(value))return false;if(value==='')return true;const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));return y>=2000&&y<=2100&&date.getUTCFullYear()===y&&date.getUTCMonth()+1===m&&date.getUTCDate()===d;};
export function normalizeHomeAsset(value){
 if(!exact(value,['kind','make','model','year','usageUnit','usageEntries','warrantyEndDay','receiptNote',...(value&&Object.hasOwn(value,'receiptFile')?['receiptFile']:[])])||!['possession','vehicle'].includes(value.kind)||!text(value.make,80)||!text(value.model,100)||!/^$|^(?:19|20|21)\d{2}$/.test(value.year)||!['miles','hours','cycles'].includes(value.usageUnit)||!Array.isArray(value.usageEntries)||value.usageEntries.length>100||!day(value.warrantyEndDay)||!text(value.receiptNote,2000))throw Error('Supported Home asset profile required.');
 if(Object.hasOwn(value,'receiptFile')&&(!exact(value.receiptFile,['documentId','linkId'])||!isDocumentId(value.receiptFile.documentId)||!isDocumentId(value.receiptFile.linkId)))throw Error('Invalid maintenance receipt link.');
 if(value.kind==='vehicle'&&value.usageUnit!=='miles'||value.kind==='possession'&&value.usageUnit==='miles')throw Error('Choose a usage unit that matches this asset.');
 let priorDay='',priorValue=-1;
 const usageEntries=value.usageEntries.map(entry=>{if(!exact(entry,['day','value','note'])||!day(entry.day)||!entry.day||!Number.isSafeInteger(entry.value)||entry.value<0||!text(entry.note,200))throw Error('Usage entries need a date, whole-number reading and optional note.');if(entry.day<priorDay||entry.value<priorValue)throw Error('Usage history must stay chronological and nondecreasing.');priorDay=entry.day;priorValue=entry.value;return{day:entry.day,value:entry.value,note:entry.note};});
 return{kind:value.kind,make:value.make,model:value.model,year:value.year,usageUnit:value.usageUnit,usageEntries,warrantyEndDay:value.warrantyEndDay,receiptNote:value.receiptNote,...(value.receiptFile?{receiptFile:{linkId:value.receiptFile.linkId,documentId:value.receiptFile.documentId}}:{})};
}
export function readHomeAsset(value){try{return normalizeHomeAsset(value)}catch{return null}}
