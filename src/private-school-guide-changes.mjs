import {schoolGuideVersions} from './private-school-guides.mjs';

export const guideFieldLabels=Object.freeze({credits:'Course credits',totalCredits:'Total program credits',totalTerms:'Total program terms'});
const maxima={credits:30,totalCredits:1000,totalTerms:100};
const fields=kind=>kind==='degree'?['totalCredits','totalTerms']:['credits'];
const numeric=(key,v)=>Number.isFinite(v)&&v>=0&&v<=maxima[key]&&(key!=='totalTerms'||Number.isInteger(v));
const keyOf=g=>[g.kind,g.documentId,g.field].join('/');
const identity=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
const creditLine=/^(?:course credits|credits|credit hours|competency units)\s*:\s*(\d+(?:\.\d{1,2})?)$/i;
const programLines={totalCredits:/^(?:total credits|total program credits|total competency units)\s*:\s*(\d+(?:\.\d{1,2})?)$/i,totalTerms:/^(?:total terms|total program terms)\s*:\s*(\d+)$/i};
const pattern=f=>f==='credits'?creditLine:programLines[f];

export function schoolGuideChanges(payload){
 const history=Object.hasOwn(payload,'guideChanges')?payload.guideChanges:[];
 const versions=schoolGuideVersions(payload),seen=new Set();
 if(!Array.isArray(history)||history.length>150)throw Error('Invalid guide change history.');
 for(const change of history){
  if(!change||Object.keys(change).sort().join(',')!=='after,anchor,before,documentId,field,kind,page,quote'||
    !versions.some(g=>g.kind===change.kind&&g.documentId===change.documentId)||!fields(payload.kind).includes(change.field)||
    !numeric(change.field,change.before)||!numeric(change.field,change.after)||change.before===change.after||
    !Number.isInteger(change.page)||change.page<1||change.page>80||typeof change.anchor!=='string'||change.anchor.length>180||
    !(payload.kind==='course'?/^course code\s*:\s*\S/i:/^(?:program|degree program)\s*:\s*\S/i).test(change.anchor)||
    typeof change.quote!=='string'||change.quote.length>180||!pattern(change.field).test(change.quote)||
    Number(change.quote.match(pattern(change.field))[1])!==change.after||seen.has(keyOf(change)))throw Error('Invalid guide change evidence.');
  seen.add(keyOf(change));
 }
 return history;
}

export function proposeGuideChanges(payload,guide,pages){
 const history=schoolGuideChanges(payload),versions=schoolGuideVersions(payload);
 if(!versions.some(g=>g.kind===guide.kind&&g.documentId===guide.documentId)||
   versions.filter(g=>g.kind===guide.kind).at(-1)?.documentId!==guide.documentId)return [];
 const target=identity(payload.kind==='degree'?payload.title:payload.code);
 if(!target)return [];
 const matches=new Map(),anchorPattern=payload.kind==='degree'?/^(?:program|degree program)\s*:\s*(.+)$/i:/^course code\s*:\s*(.+)$/i;
 pages.forEach((text,index)=>{
  const lines=text.split(/\r\n|[\n\r\u2028\u2029]/).map(line=>line.trim());
  const anchors=lines.map(line=>({line,match:line.match(anchorPattern)})).filter(v=>v.match);
  if(!anchors.length||anchors.some(a=>identity(a.match[1])!==target||a.line.length>180))return;
  for(const field of fields(payload.kind)){
   for(const line of lines){
    const match=line.match(pattern(field));if(!match||line.length>180)continue;
    const after=Number(match[1]);const options=matches.get(field)??new Map();matches.set(field,options);
    if(!options.has(after))options.set(after,{kind:guide.kind,documentId:guide.documentId,field,before:payload[field],after,page:index+1,anchor:anchors[0].line,quote:line});
   }
  }
 });
 return [...matches.values()].filter(options=>options.size===1).map(options=>options.values().next().value)
  .filter(change=>numeric(change.field,change.before)&&numeric(change.field,change.after)&&change.before!==change.after&&!history.some(g=>keyOf(g)===keyOf(change)));
}
