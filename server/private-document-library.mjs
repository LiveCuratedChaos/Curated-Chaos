import {suggestDocumentFields,suggestionFields} from '../src/private-document-suggestions.mjs';
import {extractDocumentPages} from './private-document-extraction.mjs';
import {documentTextQuery,matchingTextPages} from '../src/private-document-text.mjs';
import {stableStringify} from './stable-json.mjs';
import {randomBytes} from 'node:crypto';
import {documentFilter} from '../src/private-document-fields.mjs';
const token=()=>randomBytes(32).toString('base64url');
export function createDocumentLibrary({storage,now=Date.now,extract=extractDocumentPages}){
 const sessions=new Map();
 function clear(id){clearTimeout(sessions.get(id)?.timer);sessions.delete(id);}
 function begin(id,owner,expiresAt){
  clear(id);
  const v={owner,expiresAt:Math.min(now()+300000,expiresAt),choices:new Map()};
  sessions.set(id,v);
  v.timer=setTimeout(()=>{if(sessions.get(id)===v)clear(id);},Math.max(1,v.expiresAt-now()));v.timer.unref?.();
  return v;
 }
 function issue(view,doc){
  const choice=token();view.choices.set(choice,doc);return {choice,...doc.fields};
 }
 function hasChoice(id,choice){
  const view=sessions.get(id);
  return Boolean(view&&view.expiresAt>now()&&view.choices.has(choice));
 }
 async function selectedDocument(id,actor,choice){
  const view=active(id,actor),doc=view.choices.get(choice);
  if(!doc)throw Error('Choose a current document.');
  const current=await storage.inspect(actor,doc.id);
  if(stableStringify(current)!==stableStringify(doc)||active(id,actor)!==view||view.choices.get(choice)!==doc)throw Error('Document changed.');
  return {doc,expiresAt:view.expiresAt};
 }
 function openFavorite(id,actor,doc,expiresAt){
  const view=begin(id,actor.ownerId,expiresAt);
  return {document:issue(view,doc),expiresAt:view.expiresAt};
 }
 async function list(id,actor,offset,expiresAt){
  if(!Number.isInteger(offset)||offset<0||offset>100000||offset%25)throw Error('Choose a document page.');
  const v=begin(id,actor.ownerId,expiresAt);
  const {documents,hasMore}=await storage.list(actor,offset);
  if(sessions.get(id)!==v||v.expiresAt<=now())throw Error('Document view expired.');
  return {offset,hasMore,expiresAt:v.expiresAt,documents:documents.map(doc=>{
   const choice=token();v.choices.set(choice,doc);return {choice,...doc.fields};
  })};
 }
 function active(id,actor){
  const v=sessions.get(id);if(!v||v.owner!==actor.ownerId||v.expiresAt<=now())throw Error('Open your documents again.');return v;
 }
 async function search(id,actor,filter,direction){
  const v=active(id,actor);
  if(!['first','previous','next'].includes(direction))throw Error('Choose a search page.');
  const criteria=documentFilter(filter),prior=v.search;
  let trail=[null];
  if(direction!=='first'){
   if(!prior||JSON.stringify(prior.criteria)!==JSON.stringify(criteria))throw Error('Run the search again.');
   if(direction==='next'&&prior.next)trail=[...prior.trail,prior.next];
   else if(direction==='previous'&&prior.trail.length>1)trail=prior.trail.slice(0,-1);
   else throw Error('Search page unavailable.');
  }
  const marker={};v.operation=marker;v.text=null;v.review=null;v.search=null;v.contentScan=null;v.choices.clear();
  const result=await storage.search(actor,criteria,trail.at(-1));
  if(active(id,actor)!==v||v.operation!==marker)throw Error('Document search changed.');
  v.search={criteria,trail,next:result.next};
  return {criteria,hasPrevious:trail.length>1,hasMore:result.next!==null,expiresAt:v.expiresAt,
   documents:result.documents.map(doc=>{const choice=token();v.choices.set(choice,doc);return {choice,...doc.fields};})};
 }
 async function prepare(id,actor,fields,data){
  const v=active(id,actor),marker={};v.review=null;v.operation=marker;
  const proposed=await storage.prepare(actor,fields,data);
  if(active(id,actor)!==v||v.operation!==marker)throw Error('Document review changed.');
  if(proposed.existing){
   const choice=token();v.choices.set(choice,proposed.existing);return {duplicate:true,choice,fields:proposed.existing.fields,expiresAt:v.expiresAt};
  }
  v.review={token:token(),upload:proposed.row};
  return {duplicate:false,reviewId:v.review.token,fields,expiresAt:v.expiresAt};
 }
 async function organize(id,actor,choice,changes){
  const v=active(id,actor),selected=v.choices.get(choice);
  if(!selected)throw Error('Choose a file to organize.');
  const marker={};v.operation=marker;v.review=null;
  const edit=await storage.prepareEdit(actor,selected,changes);
  if(active(id,actor)!==v||v.operation!==marker)throw Error('Reopen the document.');
  v.review={token:token(),edit};
  return {reviewId:v.review.token,before:selected.fields,fields:edit.fields,expiresAt:v.expiresAt};
 }
 function claim(id,owner,reviewId){
  const v=active(id,{ownerId:owner});
  if(!v.review||v.review.token!==reviewId)throw Error('Fresh document approval required.');
  const review=v.review;v.review=null;return review;
 }
 async function save(review,actor){
  if(review.edit){const doc=await storage.saveEdit(actor,review.edit);return {saved:true,reused:false,fields:doc.fields};}
  const {document,reused}=await storage.save(actor,review.upload);return {saved:true,reused,fields:document.fields};
 }
 async function parseOriginal(actor,doc,current){
  const result=await storage.read(actor,doc);if(!current())throw Error('Document changed.');
  const bytes=Buffer.from(result.data,'base64');
  try{return await extract(bytes,{mime:doc.fields.mime,recognize:true});}finally{bytes.fill(0);}
 }
 async function searchContents(id,actor,values){
  const v=active(id,actor),query=documentTextQuery(values.query);
  if(!query||!['first','next','more'].includes(values.direction))throw Error('Enter text to find.');
  let scan;
  if(values.direction==='first'){
   if(values.continuation!==null)throw Error('Start a new search.');
   scan={query,cursor:null,shown:0,continuation:null};
   v.contentScan=scan;v.search=null;v.text=null;v.review=null;v.choices.clear();
  }else{
   scan=v.contentScan;
   if(!scan||!scan.continuation||scan.continuation!==values.continuation||scan.query!==query||
      (values.direction==='more')!==(scan.shown===25))throw Error('Restart the content search.');
   if(values.direction==='more'){scan.shown=0;v.choices.clear();v.text=null;}
  }
  scan.continuation=null;scan.ready=false;
  const marker={};v.operation=marker;
  const current=()=>active(id,actor)===v&&v.operation===marker&&v.contentScan===scan;
  const batch=await storage.textBatch(actor,scan.cursor,Math.min(2,25-scan.shown));
  const matches=[];let incomplete=0;
  for(const doc of batch.documents){
   if(!current())throw Error('Search ended.');
   const parsed=await parseOriginal(actor,doc,current);
   if(!current())throw Error('Search ended.');
   if(parsed.status==='busy')throw Error('The text reader is busy. Restart this search.');
   if(parsed.status!=='ready'){incomplete++;continue;}
   if(parsed.methods.includes('unavailable'))incomplete++;
   const pages=matchingTextPages(parsed,query);if(pages.length)matches.push({doc,pages});
  }
  for(const doc of batch.documents){
   if(stableStringify(await storage.inspect(actor,doc.id))!==stableStringify(doc)||!current())throw Error('Document changed during search.');
  }
  if(!current())throw Error('Search ended.');
  const documents=matches.map(({doc,pages})=>{
   const choice=token();v.choices.set(choice,doc);return {choice,name:doc.fields.name,pages};
  });
  scan.ready=true;scan.shown+=documents.length;scan.cursor=batch.documents.at(-1)?.id??scan.cursor;scan.continuation=batch.hasMore?token():null;
  return {query,scanned:batch.documents.length,incomplete,documents,continuation:scan.continuation,expiresAt:v.expiresAt};
 }
 async function readText(id,actor,{choice,page,query}){
  const view=active(id,actor),doc=view.choices.get(choice),needle=documentTextQuery(query);
  if(!doc||!Number.isInteger(page)||page<1||page>80)throw Error('Choose a current document and page.');
  const marker={};view.operation=marker;
  const current=()=>active(id,actor)===view&&view.operation===marker&&view.choices.get(choice)===doc;
  let parsed=view.text?.choice===choice?view.text.parsed:null;
  if(!parsed){
   view.text=null;
   parsed=await parseOriginal(actor,doc,current);
  }
  if(stableStringify(await storage.inspect(actor,doc.id))!==stableStringify(doc)||!current())throw Error('Document changed.');
  if(parsed.status!=='ready')return {name:doc.fields.name,status:parsed.status};
  if(page>parsed.pages.length)throw Error('Unknown document page.');
  view.text={choice,parsed};
  const matches=matchingTextPages(parsed,needle);
  return {status:'ready',name:doc.fields.name,page,pages:parsed.pages.length,text:parsed.pages[page-1],method:parsed.methods?.[page-1]??'text',query:needle,matches,unreadPages:parsed.methods.flatMap((m,i)=>m==='unavailable'?[i+1]:[])};
 }
 async function selectedText(id,actor,choice){
  const view=active(id,actor),doc=view.choices.get(choice),text=view.text;
  if(!doc||!text||text.choice!==choice||text.parsed.status!=='ready')throw Error('Open the current file first.');
  if(stableStringify(await storage.inspect(actor,doc.id))!==stableStringify(doc)||active(id,actor)!==view||view.text!==text||view.choices.get(choice)!==doc)throw Error('File changed.');
  return {doc,parsed:text.parsed};
 }
 async function suggest(id,actor,choice){
  const view=active(id,actor),doc=view.choices.get(choice),text=view.text;
  if(!doc||!text||text.choice!==choice)throw Error('Open the current file text first.');
  const marker={};view.operation=marker;view.review=null;text.suggestions=null;
  if(stableStringify(await storage.inspect(actor,doc.id))!==stableStringify(doc)||active(id,actor)!==view||view.text!==text||view.operation!==marker)throw Error('Document changed.');
  const suggestions=new Map();
  const candidates=suggestDocumentFields(doc.fields,text.parsed).map(proposal=>{
   const value=token();suggestions.set(value,proposal);return {suggestion:value,...proposal};
  });
  text.suggestions=suggestions;
  return {name:doc.fields.name,candidates};
 }
 async function reviewSuggestion(id,actor,choice,suggestion){
  const view=active(id,actor),doc=view.choices.get(choice),text=view.text;
  const proposal=text?.choice===choice?text.suggestions?.get(suggestion):null;
  if(!doc||!proposal)throw Error('Reopen document suggestions.');
  const {mime,bytes,...changes}=suggestionFields(doc.fields,proposal);
  text.suggestions=null;
  return organize(id,actor,choice,changes);
 }
 async function download(id,actor,choice){
  const v=active(id,actor),doc=v.choices.get(choice);if(!doc)throw Error('Choose a document.');
  const r=await storage.read(actor,doc);if(active(id,actor)!==v)throw Error('Document view changed.');
  return {fields:r.fields,data:r.data};
 }
 function checkedSearch(id,actor){
  const view=active(id,actor);
  if(view.review)throw Error('Finish the document review first.');
  if(view.contentScan?.ready)return{type:'document-text',query:view.contentScan.query};
  if(view.search)return{type:'document-library',query:view.search.criteria.text,collection:view.search.criteria.collection};
  throw Error('Run the document search again before naming it.');
 }
 return {list,search,searchContents,checkedSearch,hasChoice,selectedDocument,openFavorite,prepare,organize,claim,save,download,readText,selectedText,suggest,reviewSuggestion,clear,dispose(){for(const id of sessions.keys())clear(id);}};
}
