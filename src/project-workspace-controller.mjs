import {ORG_SECTIONS,PROJECT_STATUSES,TASK_STATUSES,TASK_PRIORITIES} from './dev-organize-model.mjs';

// No transport, credentials or persistent cache: the lead injects the authenticated client.
export async function mountProjectWorkspace({root,client,ownerId,day,model}={}){
 if(!root?.ownerDocument||!client||['list','create','update','undo','history'].some(key=>typeof client[key]!=='function'))throw Error('Workspace dependencies required.');
 model ||= await import('./project-workspace-model.mjs');
 const doc=root.ownerDocument;let rows=[],view='all',projectId='',draft=null,busy=false,uncertain=false,receipt=null,message='',history=[],historyRecord=null,historyRequest=0,disposed=false,epoch=0,deferredFocus=null;
 const uuid=()=>globalThis.crypto.randomUUID();
 const attr=(node,name)=>node?.getAttribute?.(name);
 const controls=()=>Array.from(root.querySelectorAll?.('input,textarea,select')||[]);
 function focusField(saved,{reveal=false}={}){if(!saved||draft!==saved.draft||busy||disposed)return;const node=controls().find(n=>saved.subtaskId?attr(n,'data-subtask-id')===saved.subtaskId:attr(n,'name')===saved.name);if(!node||node.disabled)return;node.focus?.({preventScroll:!reveal});if(Number.isInteger(saved.start)&&Number.isInteger(saved.end))try{node.setSelectionRange(saved.start,saved.end);}catch{/* Date/select controls do not expose text selection. */}}
 function focusButton(label){const node=Array.from(root.querySelectorAll?.('button')||[]).find(n=>n.textContent===label&&!n.disabled);node?.focus?.({preventScroll:false});}
 function focusedField(){const node=doc.activeElement;if(!draft||!node||!root.contains?.(node))return null;const name=attr(node,'name'),subtaskId=attr(node,'data-subtask-id');return name||subtaskId?{draft,node,name,subtaskId,start:node.selectionStart,end:node.selectionEnd}:null;}

 const el=(tag,text,attributes={})=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);return node;};
 const button=(text,action,disabled=false)=>{const node=el('button',text,{type:'button'});node.disabled=disabled;node.addEventListener('click',action);return node;};
 const field=(form,label,key,value,options)=>{
  const wrapper=el('label',label);const node=el(options?'select':key==='summary'||key==='description'?'textarea':'input',undefined,{'aria-label':label,name:key});
  if(options)for(const option of options){const [value,text]=Array.isArray(option)?option:[option,option];const item=el('option',text,{value});node.append(item);}
  else if(key==='day')node.type='date';else if(key==='title')node.maxLength=140;
  if(key==='summary'||key==='description')node.maxLength=10000;
  node.value=value??'';node.disabled=busy;node.addEventListener('input',()=>{draft.form[key]=node.value;});node.addEventListener('change',()=>{draft.form[key]=node.value;});wrapper.append(node);form.append(wrapper);return node;
 };
 function start(kind,record){
  if(busy||uncertain||disposed||draft)return;
  historyRequest++;history=[];historyRecord=null;deferredFocus=null;
  const payload=record?.payload||{};
  draft={kind,record,form:{title:payload.title||'',section:record?.section||'Personal Life',status:payload.status||(kind==='project'?'Planned':'Not Started'),...(kind==='project'?{summary:payload.summary||''}:{description:payload.description||'',day:payload.day||'',priority:payload.priority||'Normal',project_id:payload.project_id||'',subtasks:(payload.subtasks||[]).map(task=>({...task}))})}};message='Draft kept only on this page. Save explicitly; offline saving is not available.';render();focusField({draft,name:'title'},{reveal:true});
 }
 function checkedRows(value){if(!Array.isArray(value))throw Error();const normalized=model.normalizeProjectWorkspace(value,ownerId);if(normalized.projects.length+normalized.tasks.length!==value.length)throw Error();return value;}
 async function reload(){
  if(busy||disposed)return;historyRequest++;history=[];historyRecord=null;busy=true;const ticket=epoch;render();
  try{const result=await client.list();if(disposed||ticket!==epoch)return;rows=checkedRows(result);message=uncertain?'Save outcome unknown. Check the refreshed records before leaving; this page will not retry.':'Up to date.';}
  catch{if(ticket===epoch&&!disposed)message=uncertain?'Could not load a verified list. Save outcome remains unknown; no changes were retried.':'Could not load a verified list. Your draft was not sent. The previous view may be out of date; try Refresh when connected.';}
  finally{if(ticket===epoch&&!disposed){busy=false;render();}}
 }
 async function mutate(action){
  if(busy||uncertain||disposed)return;historyRequest++;history=[];historyRecord=null;busy=true;message='Saving…';const ticket=epoch;render();
  try{const result=await action(uuid());if(disposed||ticket!==epoch)return;if(!result?.record||typeof result.operationId!=='string'||!result.operationId||typeof result.record.id!=='string'||!Number.isSafeInteger(result.record.version)||result.record.version<1)throw Error();
   const record=result.record;let next;
   if(result.replayed===true){
    // An immutable receipt can describe a version that was subsequently changed or removed.
    // Validate its actor envelope, then use only a fresh coherent list as live state.
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(record.id)||record.owner_id!==ownerId||record.visibility!=='private'||record.household_id!==null||record.origin!=='CC_MANUAL_WORKSPACE'||!['project','task'].includes(record.item_type)||!ORG_SECTIONS.includes(record.section)||record.payload?.schemaVersion!==1||record.payload.source!=='manual'||record.payload.fictional!==false||record.deleted_at!==null&&(typeof record.deleted_at!=='string'||!Number.isFinite(Date.parse(record.deleted_at))))throw Error();
    next=await client.list();if(disposed||ticket!==epoch)return;checkedRows(next);
   }else{
   const previous=rows.find(row=>row.id===record.id);
   if(previous&&record.version<=previous.version)throw Error();
   const remaining=rows.filter(row=>row.id!==record.id);
   if(record.deleted_at!==null){if(!previous||typeof record.deleted_at!=='string'||!Number.isFinite(Date.parse(record.deleted_at)))throw Error();model.normalizeProjectWorkspace([{...record,deleted_at:null},...remaining],ownerId);}
   next=record.deleted_at===null?[...remaining,record]:remaining;
   checkedRows(next);
   }
   rows=next;
   if(projectId&&!next.some(row=>row.item_type==='project'&&row.id===projectId))projectId='';receipt=result;draft=null;history=[];message='Saved. You can Undo while this version is current.';}
  catch{if(ticket===epoch&&!disposed){uncertain=true;message='Save outcome unknown. Your draft stays here. Refresh to check; no automatic retry or further writes on this page.';}}
  finally{if(ticket===epoch&&!disposed){busy=false;render();}}
 }
 function save(){
  if(!draft||busy||uncertain)return;
  let value;const {kind,record,form}=draft;
  try{const projects=model.normalizeProjectWorkspace(rows,ownerId).projects;const fields=kind==='project'?{title:form.title,summary:form.summary,status:form.status,section:form.section}:{...form,day:form.day||null,project_id:form.project_id||null};
   value=record?(kind==='project'?model.changeManualProject(record,{title:fields.title,summary:fields.summary,status:fields.status},ownerId):model.changeManualTask(record,{title:fields.title,description:fields.description,day:fields.day,status:fields.status,priority:fields.priority,project_id:fields.project_id,subtasks:fields.subtasks},ownerId,projects)):(kind==='project'?model.makeManualProject(fields,ownerId):model.makeManualTask(fields,ownerId,projects));
  }catch{message='Check the title, date, section and project selection. Draft has not been sent.';render();return;}
  return mutate(operationId=>record?client.update({operationId,id:record.id,expectedVersion:record.version,payload:value}):client.create({operationId,record:value}));
 }
 async function showHistory(record){
  if(disposed||busy||uncertain||draft)return;const ticket=epoch,request=++historyRequest;history=[];historyRecord={id:record.id,title:record.payload.title,version:record.version};message='Loading change history…';render();
  const current=()=>!disposed&&ticket===epoch&&request===historyRequest&&!draft&&rows.some(row=>row.id===record.id&&row.version===record.version);
  try{const result=await client.history({id:record.id});if(!current())return;const ids=new Set(),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
   if(!Array.isArray(result)||result.length>100)throw Error();
   for(const item of result){if(!item||typeof item!=='object'||Object.keys(item).some(k=>!['operationId','recordId','kind','resultVersion','createdAt','targetOperationId'].includes(k))||!uuid(item.operationId)||ids.has(item.operationId.toLowerCase())||item.recordId!==record.id||!['create','update','undo'].includes(item.kind)||!Number.isSafeInteger(item.resultVersion)||item.resultVersion<1||item.resultVersion>record.version||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))||item.targetOperationId!=null&&!uuid(item.targetOperationId)||item.kind==='undo'&&!uuid(item.targetOperationId))throw Error();ids.add(item.operationId.toLowerCase());}
   history=result;message='Saved change history';render();
  }catch{if(current()){history=[];historyRecord=null;message='History unavailable. Refresh before reopening.';render();}}
 }
 function render(){
  if(disposed)return;const active=doc.activeElement,saved=focusedField();if(saved)deferredFocus=saved;else if(active&&active!==doc.body&&active!==deferredFocus?.node)deferredFocus=null;root.replaceChildren();root.append(el('h1','Projects and tasks'));
  const status=el('p',message,{role:'status','aria-live':'polite'});root.append(status);
  const actions=el('nav',undefined,{'aria-label':'Workspace actions'});actions.append(button('New project',()=>start('project'),busy||uncertain||Boolean(draft)),button('New task',()=>start('task'),busy||uncertain||Boolean(draft)),button('Refresh',reload,busy));
  if(receipt)actions.append(button('Undo last save',()=>mutate(operationId=>client.undo({operationId,targetOperationId:receipt.operationId})),busy||uncertain||Boolean(draft)));root.append(actions);
  let data,normalized;try{data=model.projectWorkspaceView(rows,ownerId,{day,view,projectId:projectId||null});normalized=model.normalizeProjectWorkspace(rows,ownerId);}catch{root.append(el('p','Workspace could not be displayed.'));return;}
  const filters=el('nav',undefined,{'aria-label':'Task filters'});for(const [value,label]of [['today','Today'],['upcoming','Upcoming'],['undated','Undated'],['completed','Completed'],['all','All']]){const node=button(label,()=>{view=value;render();});node.setAttribute('aria-pressed',String(view===value));filters.append(node);}root.append(filters);
  const scope=el('label','Project filter');const select=el('select',undefined,{'aria-label':'Project filter'});select.append(el('option','All projects',{value:''}));for(const project of normalized.projects)select.append(el('option',project.payload.title,{value:project.id}));select.value=projectId;select.addEventListener('change',()=>{projectId=select.value;render();});scope.append(select);root.append(scope);
  const projects=el('section',undefined,{'aria-label':'Projects'});projects.append(el('h2','Projects'));
  for(const project of data.projects){const card=el('article');const tasks=normalized.tasks.filter(task=>task.payload.project_id===project.id);const progress=data.counts?.projectCounts?.find(row=>row.project.id===project.id)?.progress||{completed:tasks.filter(task=>task.payload.status==='Completed').length,total:tasks.length};card.append(el('h3',project.payload.title),el('p',`${progress.completed} of ${progress.total} tasks complete`),el('p',project.payload.summary||''),button('Edit project',()=>start('project',project),busy||uncertain||Boolean(draft)),button('Project history',()=>showHistory(project),busy||uncertain||Boolean(draft)));if(progress.recurringTotal)card.append(el('p',`${progress.recurringCompleted} of ${progress.recurringTotal} repeating occurrences complete · ${progress.separateRecurring?'shown separately; kept linked':'included in completion'}`));projects.append(card);}root.append(projects);
  const tasks=el('section',undefined,{'aria-label':'Tasks'});tasks.append(el('h2','Tasks'));if(Number.isInteger(data.counts?.total))tasks.append(el('p',`${data.counts.total} tasks in this view · ${data.counts.completed} complete`));if(!data.tasks.length)tasks.append(el('p','No tasks in this view.'));
  for(const task of data.tasks){const card=el('article');card.append(el('h3',task.payload.title),el('p',`${task.payload.status} · ${task.payload.day||'Undated'} · ${task.payload.priority}`),button('Edit task',()=>start('task',task),busy||uncertain||Boolean(draft)),button(task.payload.status==='Completed'?'Reopen':'Complete',()=>{let payload;try{payload=model.changeManualTask(task,{status:task.payload.status==='Completed'?'Not Started':'Completed'},ownerId,model.normalizeProjectWorkspace(rows,ownerId).projects);}catch{message='Task could not be changed.';render();return;}return mutate(operationId=>client.update({operationId,id:task.id,expectedVersion:task.version,payload}));},busy||uncertain||Boolean(draft)),button('Task history',()=>showHistory(task),busy||uncertain||Boolean(draft)));tasks.append(card);}root.append(tasks);
  if(draft){const form=el('form');form.append(el('h2',(draft.record?'Edit ':'New ')+draft.kind));field(form,'Title','title',draft.form.title);if(!draft.record){const section=field(form,'Section','section',draft.form.section,ORG_SECTIONS);section.addEventListener('change',()=>{draft.form.project_id='';render();});}else form.append(el('p','Section: '+draft.record.section));
   field(form,'Status','status',draft.form.status,draft.kind==='project'?PROJECT_STATUSES:TASK_STATUSES);
   if(draft.kind==='project')field(form,'Summary','summary',draft.form.summary);else{field(form,'Description','description',draft.form.description);field(form,'Due date','day',draft.form.day);field(form,'Priority','priority',draft.form.priority,TASK_PRIORITIES);field(form,'Assigned project','project_id',draft.form.project_id,[['','No project'],...normalized.projects.filter(project=>project.section===draft.form.section).map(project=>[project.id,project.payload.title])]);
    const list=el('fieldset');list.append(el('legend','Subtasks'));draft.form.subtasks.forEach((task,index)=>{const label=el('label');const check=el('input',undefined,{type:'checkbox','aria-label':'Subtask complete '+(index+1)});check.checked=task.done;check.disabled=busy;check.addEventListener('change',()=>{task.done=check.checked;});const title=el('input',undefined,{'aria-label':'Subtask title '+(index+1),'data-subtask-id':task.id});title.value=task.title;title.disabled=busy;title.maxLength=140;title.addEventListener('input',()=>{task.title=title.value;});label.append(check,title,button('Remove subtask',()=>{const next=draft.form.subtasks[index+1]?.id||draft.form.subtasks[index-1]?.id;draft.form.subtasks.splice(index,1);render();if(next)focusField({draft,subtaskId:next},{reveal:true});else focusButton('Add subtask');},busy));list.append(label);});list.append(button('Add subtask',()=>{const id=uuid();draft.form.subtasks.push({id,title:'',done:false});render();focusField({draft,subtaskId:id},{reveal:true});},busy||draft.form.subtasks.length>=40));form.append(list);
   }
   const submit=el('button','Save',{type:'submit'});submit.disabled=busy||uncertain;form.append(submit,button('Discard draft',()=>{const kind=draft.kind;draft=null;deferredFocus=null;render();focusButton('New '+kind);},busy||uncertain));form.addEventListener('submit',event=>{event.preventDefault();save();});root.append(form);
  }
  if(historyRecord){const section=el('section',undefined,{'aria-label':'Change history'});section.append(el('h2','Change history: '+historyRecord.title));if(history.length){section.append(el('p',`Showing ${Math.min(50,history.length)} of ${history.length} returned changes (latest 100 maximum).`));for(const item of history.slice(0,50))section.append(el('p',`${({create:'Created',update:'Updated',undo:'Undid change'})[item.kind]} · Version ${item.resultVersion} · ${item.createdAt}`));}else if(message==='Saved change history')section.append(el('p','No change history returned.'));section.append(button('Close history',()=>{historyRequest++;history=[];historyRecord=null;message='';render();}));root.append(section);}
  if(!busy){const target=saved||deferredFocus;deferredFocus=null;focusField(target);}
 }
 function clear(){disposed=true;deferredFocus=null;epoch++;historyRequest++;rows=[];draft=null;receipt=null;history=[];historyRecord=null;busy=false;uncertain=false;message='';root.replaceChildren();}
 render();await reload();return {refresh:reload,clear,dispose(){clear();disposed=true;}};
}
