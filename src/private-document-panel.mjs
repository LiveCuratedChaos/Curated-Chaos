import {documentFavoriteButton} from './private-favorite-item-panel.mjs';
import {appendContentResults,renderContentResults} from './private-document-content-search.mjs';
import {guideLabels} from './private-school-guides.mjs';
import {suggestionFields} from './private-document-suggestions.mjs';
import {documentTextQuery,verifyDocumentText,renderDocumentText} from './private-document-text.mjs';
import {escapeHtml as e} from './core.mjs';
import {documentFields,documentFilter,DOCUMENT_COLLECTIONS,DOCUMENT_LIMIT,DOCUMENT_TYPES,DOCUMENT_CLASSES} from './private-document-fields.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=(v,s)=>v&&Object.keys(v).sort().join(',')===s;
const button=(action,text,off=false)=>'<button type="button" class="btn" data-document-action="'+e(action)+'" '+(off?'disabled':'')+'>'+e(text)+'</button>';
const size=n=>n<1024?n+' bytes':n<1048576?Math.ceil(n/1024)+' KB':(n/1048576).toFixed(1)+' MB';
function encode(bytes){
 let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);
}
export function downloadFile(bytes,fields){
 const url=URL.createObjectURL(new Blob([bytes],{type:fields.mime})),anchor=document.createElement('a');
 anchor.href=url;anchor.download=fields.name;
 try{document.body.append(anchor);anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
export function downloadCheckedDocument(v,expected,download=downloadFile){
 if(!keys(v,'data,fields'))throw Error('Invalid file.');
 const fields=documentFields(v.fields);
 if((expected&&!equal(fields,expected))||typeof v.data!=='string'||v.data.length!==4*Math.ceil(fields.bytes/3))throw Error('Invalid file.');
 const bytes=Uint8Array.from(atob(v.data),c=>c.charCodeAt(0));if(bytes.length!==fields.bytes)throw Error('Invalid file.');
 download(bytes,fields);
}
export function createDocumentPanel({client,clock=Date.now,allowSchoolLinks=false,allowFavorites=false,onNameSearch=null,canOpen=()=>true,onChange=()=>{},download=downloadFile}){
 let reading=null,readQuery='',scan=null,contentQuery='';
 let seq=0,view,draft,review,duplicate,status,busy,timer,filter;
 function reset(){seq++;reading=null;readQuery='';scan=null;contentQuery='';clearTimeout(timer);view=draft=review=duplicate=null;status='';busy=false;filter={collection:'all',text:''};}reset();
 const fresh=()=>view?.expiresAt>clock();
 function choices(rows){
  if(!Array.isArray(rows)||rows.length>25||new Set(rows.map(r=>r.choice)).size!==rows.length)throw Error('Invalid document page.');
  return rows.map(({choice,...fields})=>{if(!token(choice))throw Error();return {choice,fields:documentFields(fields)};});
 }
 async function list(offset=0,notice=''){
  reset();const n=seq;busy=true;onChange();
  try{
   const v=await client.documentList(offset);if(n!==seq)return;
   if(!keys(v,'documents,expiresAt,hasMore,offset')||v.offset!==offset||typeof v.hasMore!=='boolean'||v.expiresAt<=clock()||
    !Number.isFinite(v.expiresAt)||v.expiresAt>clock()+300000||!Array.isArray(v.documents)||v.documents.length>25||
    v.hasMore&&v.documents.length!==25||new Set(v.documents.map(a=>a.choice)).size!==v.documents.length)throw Error();
   const documents=choices(v.documents);
   view={...v,documents};status=notice;timer=setTimeout(()=>{reset();status='Document access expired. Open your library again.';onChange();},Math.max(1,v.expiresAt-clock()));timer.unref?.();
  }catch{if(n===seq)status='Could not open your documents.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function openFavorite(key,row,deadline){
  if(!allowFavorites||!canOpen()||busy||!token(key)||deadline<=clock())return;
  reset();const n=seq;busy=true;onChange();
  try{
   const result=await client.favoriteDocumentOpen(key);
   if(n!==seq)return;
   if(!keys(result,'document,expiresAt')||!Number.isFinite(result.expiresAt)||result.expiresAt<=clock()||result.expiresAt>deadline)throw Error();
   const documents=choices([result.document]);
   if(documents[0].fields.name!==row.title)throw Error();
   view={documents,expiresAt:result.expiresAt,offset:0,hasMore:false,favorite:true};
   timer=setTimeout(()=>{reset();status='Document access expired. Open your library again.';onChange();},result.expiresAt-clock());timer.unref?.();
  }catch{if(n===seq)status='This favorite could not be opened. Refresh your Favorites and try again.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function search(direction){
  const n=seq;busy=true;status='';onChange();
  try{
   const criteria=documentFilter(direction==='first'?filter:view.criteria);
   const v=await client.documentSearch(criteria,direction);if(n!==seq||!fresh())return;
   if(!keys(v,'criteria,documents,expiresAt,hasMore,hasPrevious')||v.expiresAt!==view.expiresAt||
      typeof v.hasMore!=='boolean'||typeof v.hasPrevious!=='boolean'||!equal(criteria,documentFilter(v.criteria)))throw Error();
   view={...v,documents:choices(v.documents)};filter={...criteria};
  }catch{if(n===seq){reset();status='Search could not be verified. Reopen your documents.';}}
  finally{if(n===seq){busy=false;}onChange();}
 }
 async function findContents(query,more=false){
  if(busy||!fresh())return;
  let term;
  try{term=documentTextQuery(query);if(!term)throw Error();}catch{status='Enter text to find in your documents.';onChange();return;}
  if(more&&(!scan?.continuation||scan.hits.length!==25))return;
  const n=++seq,expiry=view.expiresAt;busy=true;status='';
  scan=more?{...scan,hits:[]}:{query:term,hits:[],scanned:0,incomplete:0,continuation:null};
  // A content query replaces the selectable files from a previous metadata page.
  view.documents=[];onChange();
  let direction=more?'more':'first';
  try{
   do{
    const result=await client.searchDocumentContents({query:term,direction,continuation:scan.continuation});
    if(n!==seq||!fresh())return;
    scan=appendContentResults(scan,result,expiry);direction='next';onChange();
   }while(scan.continuation&&scan.hits.length<25);
  }catch{if(n===seq){reset();status='Content search stopped before it finished. Open the library to retry.';}}
  finally{if(n===seq)busy=false;onChange();}
 }
 async function openContentSearch(query){
  if(busy||draft||review||!canOpen())return;
  let term;try{term=documentTextQuery(query);if(!term)throw Error();}catch{status='Enter text to find in your documents.';onChange();return;}
  const expected=seq+1;await list();
  if(seq!==expected||!fresh()||busy||!canOpen())return;
  contentQuery=term;await findContents(term);
 }
 async function openSavedSearch(filters){
  if(filters.type==='document-text')return openContentSearch(filters.query);
  if(busy||draft||review||!canOpen())return;
  const criteria=documentFilter({text:filters.query,collection:filters.collection}),expected=seq+1;
  await list();if(seq!==expected||!fresh()||busy||!canOpen())return;
  filter=criteria;await search('first');
 }
 async function nameSearch(){
  if(!onNameSearch||!canOpen()||busy||!fresh()||draft||reading||review)return;
  const expected=scan?{type:'document-text',query:scan.query}:view.criteria?{type:'document-library',query:view.criteria.text,collection:view.criteria.collection}:null;
  if(!expected)return;
  const n=seq;busy=true;status='';onChange();
  try{
   const offer=await client.documentSearchOffer();if(n!==seq||!fresh())return;
   busy=false;
   if(!canOpen()||!onNameSearch(offer,expected))throw Error();
  }catch{if(n===seq)status='Run this document search again before naming it.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function prepare(){
  if(!fresh()||!draft||!draft.file&&!draft.item)return;
  const n=seq;busy=true;status='';onChange();
  try{
   const f=draft.file,changes={name:draft.name.trim(),folder:draft.folder.trim(),tags:draft.tags.split(',').map(t=>t.trim()).filter(Boolean)};
   const optional={};
   for(const key of ['classification','expiresOn']){
    if(draft[key])optional[key]=draft[key];
    if(draft[key]||draft.item?.fields[key])changes[key]=draft[key]||'';
   }
   const fields=documentFields({mime:draft.item?.fields.mime??f.type,bytes:draft.item?.fields.bytes??f.size,name:changes.name,folder:changes.folder,tags:changes.tags,...optional});
   if(draft.item){
    const v=await client.documentOrganize(draft.item.choice,changes);if(n!==seq||!fresh())return;
    if(!keys(v,'before,expiresAt,fields,reviewId')||v.expiresAt!==view.expiresAt||!token(v.reviewId)||
       !equal(documentFields(v.before),draft.item.fields)||!equal(documentFields(v.fields),fields))throw Error();
    review={id:v.reviewId,fields,before:draft.item.fields};return;
   }
   const bytes=new Uint8Array(await f.arrayBuffer());if(n!==seq||!fresh())return;
   if(bytes.length!==f.size)throw Error();
   const v=await client.documentReview(fields,encode(bytes));if(n!==seq||!fresh())return;
   if(v.expiresAt!==view.expiresAt)throw Error();
   if(keys(v,'choice,duplicate,expiresAt,fields')&&v.duplicate===true&&token(v.choice)){
    duplicate={choice:v.choice,fields:documentFields(v.fields)};draft=null;
   }else{
    if(!keys(v,'duplicate,expiresAt,fields,reviewId')||v.duplicate!==false||!token(v.reviewId)||!equal(documentFields(v.fields),fields))throw Error();
    review={id:v.reviewId,fields};
   }
  }catch{if(n===seq)status='Check the file type, name, size, folder and tags. Your selection is retained.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function save(){
  const n=seq,r=review;review=null;busy=true;onChange();
  try{
   const v=await client.documentSave(r.id);if(n!==seq)return;
   if(!keys(v,'fields,reused,saved')||v.saved!==true||typeof v.reused!=='boolean'||(!v.reused&&!equal(documentFields(v.fields),r.fields)))throw Error();
   await list(0,r.before?'Document details saved.':v.reused?'These bytes were already saved in your library.':'Document saved.');
  }catch{if(n===seq){reset();status='Save could not be confirmed. Reopen the library to check before retrying.';onChange();}}
 }
 async function get(item){
  const n=seq;busy=true;status='';onChange();
  try{
   const v=await client.documentDownload(item.choice);if(n!==seq||!fresh())return;
   downloadCheckedDocument(v,item.fields,download);status='Download prepared.';
  }catch{if(n===seq)status='Could not verify the original file. Reopen your library.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 const info=f=>'<strong>'+e(f.name)+'</strong> · '+e(f.mime)+' · '+e(size(f.bytes))+
  (f.classification?' · Type '+e(f.classification):'')+(f.expiresOn?' · Expires '+e(f.expiresOn):'')+(f.folder?' · Folder '+e(f.folder):'')+(f.tags.length?' · Tags '+e(f.tags.join(', ')):'');
 async function readText(item,page,query){
  const n=seq;busy=true;status='';onChange();
  try{
   const term=documentTextQuery(query),result=await client.documentText(item.choice,page,term);
   if(n!==seq||!fresh())return;
   reading={item,result:verifyDocumentText(result,item.fields.name,page,term)};readQuery=term;
  }catch{if(n===seq){reading=null;status='Could not open this text. Fetch the latest file and try again.';}}
  finally{if(n===seq){busy=false;onChange();}}
 }
 const suggestionLabel={classification:'Document type',tag:'Add tag',expiresOn:'Expiry date'};
 const proof=row=>'Page '+row.page+' · '+(row.method==='ocr'?'Image recognition · ':'')+'<q>'+e(row.quote)+'</q>';
 async function suggestions(item,proposal){
  const n=seq;busy=true;status='';onChange();
  try{
   if(proposal){
    const expected=suggestionFields(item.fields,proposal);
    const v=await client.documentSuggestionReview(item.choice,proposal.suggestion);
    if(n!==seq||!fresh())return;
    if(!keys(v,'before,expiresAt,fields,reviewId')||v.expiresAt!==view.expiresAt||!token(v.reviewId)||
       !equal(documentFields(v.before),item.fields)||!equal(documentFields(v.fields),expected))throw Error();
    review={id:v.reviewId,fields:expected,before:item.fields,proposal};
    reading=null;
   }else{
    const v=await client.documentSuggest(item.choice);if(n!==seq||!fresh())return;
    reading.link=null;
    if(!keys(v,'candidates,name')||v.name!==item.fields.name||!Array.isArray(v.candidates)||v.candidates.length>3||
       new Set(v.candidates.map(c=>c.suggestion)).size!==v.candidates.length||new Set(v.candidates.map(c=>c.field)).size!==v.candidates.length)throw Error();
    for(const row of v.candidates){
     if(!keys(row,'field,method,page,quote,suggestion,value')||!token(row.suggestion)||row.page>reading.result.pages)throw Error();
     suggestionFields(item.fields,row);
    }
    reading.suggestions=v.candidates;
   }
  }catch{if(n===seq)status='Could not confirm suggestions for this version. Reopen the document before trying again.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 const linkStatus={noMatch:'No single saved School record matched the guide heading and subject.',ambiguous:'More than one saved School record matches. Choose the intended record in School Library.',linked:'This original is already linked to the matching School record.',full:'The matching School record has reached its guide version limit.'};
 function linkHtml(){
  if(!allowSchoolLinks||reading.result.status!=='ready')return '';
  const link=reading.link;
  if(!link)return button('text-school','Check for a School link');
  if(link.status!=='ready')return '<p>'+e(linkStatus[link.status])+'</p>';
  return '<h3>Review School link</h3><p>'+e(link.name)+' · '+e(guideLabels[link.kind])+' · Version '+link.number+'</p><p>'+
   e(link.title)+(link.program?' · '+e(link.program):'')+'</p><p>Page '+link.page+' · '+(link.method==='ocr'?'Image recognition · ':'')+
   '<q>'+e(link.heading)+'</q> · <q>'+e(link.quote)+'</q></p>'+button('text-school-save','Approve guide link');
 }
 async function schoolLink(item,claim){
  const n=seq;busy=true;status='';onChange();
  try{
   if(claim){
    reading.link=null;
    const result=await client.documentSchoolMatchSave(claim.reviewId);if(n!==seq||!fresh())return;
    if(!keys(result,'saved')||result.saved!==true)throw Error();
    status='Guide linked to '+claim.title+'.';reading.link={status:'linked'};
   }else{
    const v=await client.documentSchoolMatch(item.choice);if(n!==seq||!fresh())return;
    if(v.status==='ready'){
     if(!keys(v,'heading,kind,method,name,number,page,program,quote,reviewId,status,title')||v.name!==item.fields.name||!token(v.reviewId)||
      !Object.hasOwn(guideLabels,v.kind)||!['text','ocr'].includes(v.method)||!Number.isInteger(v.number)||v.number<1||v.number>50||
      !Number.isInteger(v.page)||v.page<1||v.page>reading.result.pages||![v.heading,v.quote,v.title].every(t=>typeof t==='string'&&t.trim()&&t.length<=180)||
      typeof v.program!=='string'||v.program.length>140)throw Error();
    }else if(!keys(v,'status')||!Object.hasOwn(linkStatus,v.status))throw Error();
    reading.link=v;reading.suggestions=null;
   }
  }catch{if(n===seq){reading.link=null;status='Could not confirm the link. Check the original School record before trying again.';}}
  finally{if(n===seq){busy=false;onChange();}}
 }
 function suggestionHtml(){
  if(reading.result.status!=='ready')return '';
  if(!reading.suggestions)return button('text-suggest','Check for filing suggestions');
  return '<h3>Filing suggestions</h3>'+(reading.suggestions.length?'<ul>'+reading.suggestions.map(row=>
   '<li>'+e(suggestionLabel[row.field])+' · '+e(row.value)+'<p>'+proof(row)+'</p>'+
   button('text-review-'+row.suggestion,'Review '+suggestionLabel[row.field].toLowerCase())+'</li>').join('')+'</ul>':'<p>No supported filing suggestions for this document.</p>');
 }
 function render(){
  let html='<h2>Document Library</h2><p role="status">'+e(busy?'Checking documents…':status)+'</p>';
  if(!fresh())return html+button('open','Open my documents',busy);
  html+='<fieldset '+(busy?'disabled':'')+'>';
  if(onNameSearch&&!reading&&!draft&&!duplicate&&!review&&(scan||view.criteria))html+=button('name-search','Name this document search',busy||!canOpen());
  if(reading)html+=renderDocumentText(reading.result,readQuery,button)+(reading.item.contentHit?'':suggestionHtml()+linkHtml());
  else if(scan)html+=renderContentResults(scan,busy,button);
  else if(review)html+=(review.before?'<legend>Review document changes</legend><p>Current · '+info(review.before)+'</p><p>After saving · ':'<legend>Review private upload</legend><p>')+info(review.fields)+'</p>'+(review.proposal?'<p>'+proof(review.proposal)+'</p>':'')+'<p>Only you can open this document.</p>'+button('save','Approve document save')+button('edit',review.proposal?'Back to documents':'Back to file details');
  else if(duplicate)html+='<p>These file bytes are already in your library.</p><p>'+info(duplicate.fields)+'</p>'+button('existing','Download existing document')+button('list','Back to my documents');
  else if(draft)html+=(draft.item?'<legend>Organize document</legend>':'<legend>Add private document</legend><label>PDF or image, up to 8 MB<input type="file" accept="'+DOCUMENT_TYPES.join(',')+'" data-document-field="file"></label>')+
   (draft.file?'<p>Selected '+e(draft.file.name)+' · '+e(size(draft.file.size))+'</p>':'')+
   '<label>File name<input maxlength="150" data-document-field="name" value="'+e(draft.name)+'"></label><label>Folder (optional)<input maxlength="180" data-document-field="folder" value="'+e(draft.folder)+'"></label>'+
   '<label>Tags, separated by commas (optional)<input maxlength="500" data-document-field="tags" value="'+e(draft.tags)+'"></label>'+
   '<label>Document type <select data-document-field="classification"><option value="">Choose a type (optional)</option>'+DOCUMENT_CLASSES.map(type=>'<option value="'+e(type)+'" '+(draft.classification===type?'selected':'')+'>'+e(type)+'</option>').join('')+'</select></label>'+
   '<label>Expiry date (optional)<input type="date" data-document-field="expiresOn" value="'+e(draft.expiresOn||'')+'"></label>'+button('review',draft.item?'Review document changes':'Review private upload',!draft.file&&!draft.item)+button('list','Cancel');
  else html+='<legend>My documents</legend>'+button('add','Add a document')+
   '<label>Find text inside files<input type="search" maxlength="150" data-document-field="contentQuery" value="'+e(contentQuery)+'"></label>'+button('content-search','Search text in all my files')+
   '<label>Search names, folders or tags<input type="search" maxlength="150" data-document-field="text" value="'+e(filter.text)+'"></label>'+
   '<label>Collection<select data-document-field="collection">'+Object.entries(DOCUMENT_COLLECTIONS).map(([key,label])=>'<option value="'+key+'" '+(filter.collection===key?'selected':'')+'>'+e(label)+'</option>').join('')+'</select></label>'+button('search','Find documents')+
   (view.criteria?'<p>Showing '+e(DOCUMENT_COLLECTIONS[view.criteria.collection])+(view.criteria.text?' matching “'+e(view.criteria.text)+'”':'')+'</p>'+button('clear','Clear search'):'')+
   (view.documents.length?'<ul>'+view.documents.map(item=>'<li>'+info(item.fields)+' '+(allowFavorites?documentFavoriteButton(item.choice)+' ':'')+button('get-'+item.choice,'Download '+item.fields.name)+' '+button('text-open-'+item.choice,'Read and search '+item.fields.name)+' '+button('organize-'+item.choice,'Organize '+item.fields.name)+'</li>').join('')+'</ul>':view.criteria?'<p>'+(view.hasMore?'No matches in this group. Continue searching with Next documents.':'No matches on this page.')+'</p>':'<p>No documents on this page.</p>')+
   (view.offset||view.hasPrevious?button('previous','Previous documents'):'')+(view.hasMore?button('next','Next documents'):'');
  return html+(view.favorite&&!draft&&!reading&&!review&&!duplicate&&!scan&&!view.criteria?button('list','Back to my documents'):'')+button('close','Close document library')+'</fieldset>'+(scan&&busy?button('content-stop','Stop content search'):'');
 }
 return {render,reset,openFavorite,openContentSearch,openSavedSearch,blocked:()=>Boolean(draft||review||busy),input(event){
  const field=event.target.dataset?.documentField;if(!field)return false;
  if(!draft&&!reading&&!scan&&!busy&&field==='contentQuery'){contentQuery=event.target.value;return true;}
  if(reading&&!busy&&field==='textQuery'){readQuery=event.target.value;return true;}
  if(!draft&&!busy&&['text','collection'].includes(field)){filter[field]=event.target.value;return true;}
  if(!draft||review||busy)return true;
  if(field==='file'){
   if(event.type==='input')return true;
   const f=event.target.files?.[0];
   if(!f||!DOCUMENT_TYPES.includes(f.type)||!Number.isInteger(f.size)||f.size<1||f.size>DOCUMENT_LIMIT){draft.file=null;draft.name='';status='Choose a PDF, JPEG, PNG or WebP file up to 8 MB.';}
   else{draft.file=f;draft.name=f.name;status='';}onChange();
  }else if(['name','folder','tags','classification','expiresOn'].includes(field))draft[field]=event.target.value;
  return true;
 },click(event){
  const action=event.target.closest('[data-document-action]')?.dataset?.documentAction;
  if(!action)return false;
  if(action==='content-stop'&&scan&&busy){reset();status='Content search stopped.';onChange();void client.documentClose().catch(()=>{});return true;}
  if(busy)return true;
  if(action==='open'&&canOpen())void list();
  if(action==='close'){reset();onChange();void client.documentClose().catch(()=>{});return true;}
  if(!fresh())return true;
  if(action==='name-search'){void nameSearch();return true;}
  if(action.startsWith('text-open-')&&!reading&&!draft){
   const item=view.documents.find(row=>row.choice===action.slice(10));if(item)void readText(item,1,'');return true;
  }
  if(reading){
   const {item,result}=reading;
   if(action==='text-back'){reading=null;readQuery='';onChange();}
   else if(action==='text-school'&&allowSchoolLinks)void schoolLink(item,null);
   else if(action==='text-school-save'&&allowSchoolLinks&&reading.link?.status==='ready')void schoolLink(item,reading.link);
   else if(action==='text-suggest'&&result.status==='ready')void suggestions(item);
   else if(action.startsWith('text-review-')){
    const proposal=reading.suggestions?.find(row=>row.suggestion===action.slice(12));if(proposal)void suggestions(item,proposal);
   }
   else if(action==='text-find')void readText(item,result.page,readQuery);
   else if(action==='text-prev'&&result.page>1)void readText(item,result.page-1,result.query);
   else if(action==='text-next'&&result.page<result.pages)void readText(item,result.page+1,result.query);
   else if(/^text-page-[0-9]{1,2}$/.test(action)&&result.matches?.includes(Number(action.slice(10))))void readText(item,Number(action.slice(10)),result.query);
   return true;
  }
  if(scan){
   if(action==='content-more')void findContents(scan.query,true);
   else if(action==='list')void list();
   else if(action.startsWith('content-page-')){
    const match=action.match(/^content-page-([A-Za-z0-9_-]{43})-([0-9]{1,2})$/);
    const hit=match&&scan.hits.find(row=>row.choice===match[1]&&row.pages.includes(Number(match[2])));
    if(hit)void readText({choice:hit.choice,fields:{name:hit.name},contentHit:true},Number(match[2]),scan.query);
   }
   return true;
  }
  if(action==='content-search'&&!draft&&!review){void findContents(contentQuery);return true;}
  if(action==='add'&&!draft){draft={file:null,name:'',folder:'',tags:''};status='';onChange();}
  if(action==='review'&&draft&&!review)void prepare();
  if(action==='save'&&review)void save();
  if(action==='edit'&&review){review=null;onChange();}
  if(action.startsWith('organize-')&&!draft){
   const item=view.documents.find(d=>d.choice===action.slice(9));
   if(item){draft={item,name:item.fields.name,folder:item.fields.folder,tags:item.fields.tags.join(', '),classification:item.fields.classification??'',expiresOn:item.fields.expiresOn??''};status='';onChange();}
  }
  if(action==='list'||action==='clear')void list(view.offset??0);
  if(action==='search')void search('first');
  if(action==='previous'&&(view.offset||view.hasPrevious))void (view.criteria?search('previous'):list(view.offset-25));
  if(action==='next'&&view.hasMore)void (view.criteria?search('next'):list(view.offset+25));
  const item=action==='existing'?duplicate:action.startsWith('get-')?view.documents.find(d=>d.choice===action.slice(4)):null;
  if(item)void get(item);
  return true;
 }};
}
