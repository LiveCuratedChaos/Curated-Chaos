import {isDocumentId} from './private-document-fields.mjs';
// Budget expenses preserve their original dated total. Splits allocate that one total.
const text=(value,max)=>typeof value==='string'&&value===value.trim()&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const cents=n=>Number.isSafeInteger(n)&&n>=0;
function day(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const time=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
export function manualExpense(value,from,to){
 const optional=['label','receiptReference','splits','reconciliationId','receiptFile'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['category','day','amountMinor',...optional].includes(k))||
    !text(value.category,80)||!day(value.day)||value.day<from||value.day>to||!cents(value.amountMinor)||
    ('label' in value&&!text(value.label,140))||('receiptReference' in value&&!text(value.receiptReference,180)))
  throw Error('Enter a dated budget expense with an exact amount.');
 const out={category:value.category,day:value.day,amountMinor:value.amountMinor};
 if(Object.hasOwn(value,'reconciliationId')){
  if(typeof value.reconciliationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.reconciliationId))throw Error('Invalid reconciliation reference.');
  out.reconciliationId=value.reconciliationId;
 }
 if(Object.hasOwn(value,'receiptFile')){
  const f=value.receiptFile;
  if(!f||Object.keys(f).sort().join(',')!=='documentId,linkId'||!isDocumentId(f.linkId)||!isDocumentId(f.documentId))throw Error('Invalid receipt attachment.');
  out.receiptFile={linkId:f.linkId,documentId:f.documentId};
 }
 if(value.label)out.label=value.label;
 if(value.receiptReference)out.receiptReference=value.receiptReference;
 if(!Object.hasOwn(value,'splits')){
  if(!value.category)throw Error('Choose an expense category.');
  return out;
 }
 if(value.category!==''||!Array.isArray(value.splits)||value.splits.length<2||value.splits.length>20)throw Error('Split an expense between two to twenty categories.');
 const seen=new Set();let total=0n;
 out.splits=value.splits.map(part=>{
  if(!part||Object.keys(part).sort().join(',')!=='amountMinor,category'||!text(part.category,80)||!part.category||
     seen.has(part.category)||!cents(part.amountMinor)||part.amountMinor===0)throw Error('Each split needs a distinct category and a positive amount.');
  seen.add(part.category);total+=BigInt(part.amountMinor);
  return {category:part.category,amountMinor:part.amountMinor};
 });
 if(total!==BigInt(value.amountMinor))throw Error('Split amounts must add up to the expense total.');
 return out;
}
