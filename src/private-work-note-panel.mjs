import {escapeHtml as e} from './core.mjs';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const exact=(v,s)=>v&&Object.keys(v).sort().join(',')===s;
const button=(action,label,off=false)=>'<button class="btn" type="button" data-work-note="'+e(action)+'" '+(off?'disabled':'')+'>'+e(label)+'</button>';
const label=t=>typeof t==='string'&&t.trim().length&&t.length<=200;
export function workNoteEntry(){return button('open','Manage project notes');}
export function createWorkNotePanel({client,clock,project,canUse,onChange,onSaved}){
 let state=null,seq=0,busy=false,timer;
 function reset(){clearTimeout(timer);seq++;busy=false;state=null;}
 function close(){reset();onChange();}
 function current(n){const row=project();return Boolean(n===seq&&state&&row&&state.key===row.token&&state.expiry>clock()&&canUse());}
 async function load(offset=0,linkedOnly=true,message=''){
  const row=project();if(!row||!canUse()||busy)return;
  const query=state?.query?.trim()??'',n=++seq,expiry=row.expiry;
  state={key:row.token,expiry,query,linkedOnly,offset,notice:message};busy=true;onChange();
  clearTimeout(timer);timer=setTimeout(close,Math.max(1,expiry-clock()));timer.unref?.();
  try{
   const result=await client.projectNotes({projectToken:row.token,query,offset,linkedOnly});
   if(!current(n))return;
   if(!exact(result,'expiresAt,linkedOnly,notes,offset,projectTitle,query,total')||result.expiresAt!==expiry||
      result.projectTitle!==row.title||result.query!==query||result.offset!==offset||result.linkedOnly!==linkedOnly||
      !Number.isInteger(result.total)||result.total<0||result.total>2000||!Array.isArray(result.notes)||
      result.notes.length!==Math.min(50,Math.max(0,result.total-offset))||new Set(result.notes.map(x=>x.choice)).size!==result.notes.length||
      result.notes.some(v=>!exact(v,'choice,linked,title')||!token(v.choice)||!label(v.title)||typeof v.linked!=='boolean'||linkedOnly&&!v.linked))throw Error();
   state.page=result;
  }catch{if(current(n))state.error='Could not verify these notes. Reopen the current project and try again.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function choose(choice,reading){
  const note=state?.page?.notes.find(n=>n.choice===choice),row=project();
  if(!note||!row||!canUse()||busy||state.expiry<=clock()||reading&&!note.linked)return;
  const n=++seq,args={projectToken:row.token,choice};busy=true;state.error='';onChange();
  try{
   const result=reading?await client.readProjectNote(args):await client.reviewProjectNote({...args,linked:!note.linked});
   if(!current(n))return;
   if(reading){
    if(!exact(result,'body,expiresAt,readOnly,title')||result.title!==note.title||result.readOnly!==true||typeof result.body!=='string'||result.body.length>100000||result.expiresAt!==row.expiry)throw Error();
    state.note=result;
   }else{
    if(!exact(result,'expiresAt,linked,noteTitle,projectTitle,reviewId')||result.noteTitle!==note.title||result.projectTitle!==row.title||
      result.expiresAt!==row.expiry||result.linked!==!note.linked||!token(result.reviewId))throw Error();
    state.review=result;
   }
  }catch{if(current(n)){state.page=null;state.error='The project or selected note changed. Reopen the current project.';}}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function save(){
  if(!state?.review||busy||!canUse()||state.expiry<=clock())return;
  const n=++seq,review=state.review;state.review=null;state.page=null;busy=true;onChange();
  try{
   const result=await client.projectsSave(review.reviewId);
   if(!current(n))return;
   if(!exact(result,'project,saved')||result.saved!==true||result.project.title!==review.projectTitle||
      result.project.section!=='Work'||result.project.expiresAt!==state.expiry||!token(result.project.projectToken))throw Error();
   reset();onSaved(result.project);await load(0,true,review.linked?'Note linked.':'Note unlinked.');
  }catch{if(current(n))state.error='The link change could not be confirmed. Reopen the project to check it before trying again.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 function render(){
  if(!state)return '';
  let html='<section class="panel"><h2>Notes for '+e(project()?.title??'Work project')+'</h2><fieldset '+(busy?'disabled':'')+'>';
  if(state.error)html+='<p role="alert">'+e(state.error)+'</p>';
  if(state.notice)html+='<p role="status">'+e(state.notice)+'</p>';
  if(state.note)html+='<h3>'+e(state.note.title)+'</h3><pre class="private-note-body" tabindex="0">'+e(state.note.body)+'</pre>'+button('back','Back to linked notes');
  else if(state.review)html+='<h3>'+(state.review.linked?'Link':'Unlink')+' this note?</h3><p>'+e(state.review.noteTitle)+' · '+e(state.review.projectTitle)+'</p>'+button('save',state.review.linked?'Approve note link':'Approve unlink')+button('back','Back to notes');
  else{
   const page=state.page;
   html+='<label>Find a private note<input name="work-note-query" maxlength="100" value="'+e(state.query)+'"></label>'+button('linked','Show linked notes')+button('all','Find private notes');
   if(page)html+=page.notes.length?'<ul>'+page.notes.map(note=>'<li><strong>'+e(note.title)+'</strong> '+
    (note.linked?button('read-'+note.choice,'Read '+note.title):'')+button('review-'+note.choice,note.linked?'Review unlink':'Review link')+'</li>').join('')+'</ul>':'<p>'+ (page.linkedOnly?'No linked notes match this search.':'No private notes match this search.')+'</p>';
   if(page?.offset)html+=button('previous','Previous notes');
   if(page&&page.offset+50<page.total)html+=button('next','More notes');
  }
  return html+button('close','Back to project')+'</fieldset></section>';
 }
 return {render,reset,opened:()=>Boolean(state),busy:()=>busy,input(event){
  if(event.target.name!=='work-note-query')return false;if(state&&!busy)state.query=event.target.value;return true;
 },click(event){
  const action=event.target.closest('[data-work-note]')?.dataset?.workNote;if(!action)return false;
  if(busy||!canUse())return true;
  if(action==='open')void load();else if(!state)return true;
  else if(action==='close')close();
  else if(action==='back'){state.note=null;state.review=null;void load(state.offset,state.linkedOnly);}
  else if(action==='linked'||action==='all')void load(0,action==='linked');
  else if(action==='next'||action==='previous'){const p=state.page;if(p)void load(state.query.trim()===p.query?p.offset+(action==='next'?50:-50):0,state.linkedOnly);}
  else if(action.startsWith('read-'))void choose(action.slice(5),true);
  else if(action.startsWith('review-'))void choose(action.slice(7),false);
  else if(action==='save')void save();return true;
 }};
}
