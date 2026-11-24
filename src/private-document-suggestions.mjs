import {DOCUMENT_CLASSES,documentExpiry,documentFields} from './private-document-fields.mjs';

const categories=[
 ['Receipt',/^(?:payment |purchase |sales )?receipt$/i,'Finances'],
 ['Invoice',/^(?:tax |sales )?invoice$/i,'Finances'],
 ['Warranty',/^(?:(?:limited |manufacturer.s )?warranty|warranty certificate)$/i,'Warranty'],
 ['Insurance policy',/^insurance policy(?: declarations)?$/i,'Insurance'],
 ['Syllabus',/^(?:course )?syllabus$/i,'School'],
 ['Course guide',/^course guide$/i,'School'],
 ['Program guide',/^program guide$/i,'School']
];
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const expiryLine=/^(?:expires|expiry date|expiration date|valid through|warranty expires)\s*:\s*(.+)$/i;
function expiry(line){
 const match=line.match(expiryLine);if(!match)return null;
 let text=match[1];
 const spelled=text.match(/^([a-z]+) (\d{1,2}),? (\d{4})$/i);
 if(spelled){
  const month=months.findIndex(v=>v.toLowerCase()===spelled[1].toLowerCase())+1;
  if(!month)return null;
  text=spelled[3]+'-'+String(month).padStart(2,'0')+'-'+spelled[2].padStart(2,'0');
 }
 return documentExpiry(text)?text:null;
}
export function suggestDocumentFields(fields,parsed){
 if(parsed.status!=='ready'||parsed.methods.includes('unavailable'))return [];
 const kinds=new Map(),dates=new Map();let uncertainDate=false;
 parsed.pages.forEach((page,index)=>{
  for(const raw of page.split(/\r\n|[\r\n\u2028\u2029]/)){
   const line=raw.trim();if(!line||line.length>180)continue;
   const proof={page:index+1,quote:line,method:parsed.methods[index]};
   const kind=categories.find(([,pattern])=>pattern.test(line));
   if(kind&&!kinds.has(kind[0]))kinds.set(kind[0],{...proof,tag:kind[2]});
   if(expiryLine.test(line)){
    const day=expiry(line);if(!day)uncertainDate=true;else if(!dates.has(day))dates.set(day,proof);
   }
  }
 });
 const proposals=[];
 if(kinds.size===1){
  const [kind,{tag,...proof}]=[...kinds][0];
  if(!fields.classification)proposals.push({...proof,field:'classification',value:kind});
  if((!fields.classification||fields.classification===kind)&&fields.tags.length<12&&!fields.tags.some(t=>t.toLowerCase()===tag.toLowerCase()))proposals.push({...proof,field:'tag',value:tag});
 }
 if(!uncertainDate&&dates.size===1&&!fields.expiresOn){
  const [value,proof]=[...dates][0];proposals.push({...proof,field:'expiresOn',value});
 }
 return proposals;
}
export function suggestionFields(current,proposal){
 if(!proposal||!['classification','tag','expiresOn'].includes(proposal.field)||!Number.isInteger(proposal.page)||proposal.page<1||proposal.page>80||
  typeof proposal.quote!=='string'||!proposal.quote.length||proposal.quote.length>180||!['text','ocr'].includes(proposal.method)||typeof proposal.value!=='string')throw Error('Invalid document suggestion.');
 const {field,value}=proposal;
 if(field==='expiresOn'?(current.expiresOn||expiry(proposal.quote)!==value):
  !categories.some(([type,pattern,tag])=>pattern.test(proposal.quote)&&(field==='classification'?type===value&&DOCUMENT_CLASSES.includes(value)&&!current.classification:tag===value&&(!current.classification||current.classification===type))))throw Error('Document evidence changed.');
 return documentFields({...current,...(field==='tag'?{tags:[...current.tags,value]}:{[field]:value})});
}
