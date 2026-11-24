// Bounded private list templates. Templates are source records; instantiation creates a new task.
import {makeFictionalTask} from './dev-brief-model.mjs';

export const LIST_TEMPLATE_ORIGIN='PRIVATE_COOKIE_LIST_TEMPLATE';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const randomUUID=()=>globalThis.crypto?.randomUUID?.()??(()=>{throw Error('Secure server identity unavailable.');})();
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const clean=(value,max,label)=>{if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error('Enter a valid '+label+'.');return value.trim();};

export function privateListTemplateFields(value){
 if(!exact(value,['name','taskTitle','checklist'])||!Array.isArray(value.checklist)||value.checklist.length>20)throw Error('Exact bounded list-template fields required.');
 const name=clean(value.name,100,'template name'),taskTitle=clean(value.taskTitle,140,'task title'),checklist=value.checklist.map(item=>clean(item,140,'checklist step'));
 if(new Set(checklist.map(item=>item.normalize('NFKC').toLocaleLowerCase('en-US'))).size!==checklist.length)throw Error('Checklist steps must be unique.');
 return{name,taskTitle,checklist};
}

export function privateListTemplateState(row,ownerId){
 const p=row?.payload;
 if(!uuid(ownerId)||!uuid(row?.id)||row.owner_id!==ownerId||row.household_id!==null||row.visibility!=='private'||!['Personal Life','Home'].includes(row.section)||row.item_type!=='list_template'||row.origin!==LIST_TEMPLATE_ORIGIN||row.deleted_at!==null||!Number.isInteger(row.version)||row.version<1||!p||p.fictional!==true||p.schemaVersion!==1||Object.keys(p).sort().join(',')!=='checklist,fictional,name,schemaVersion,taskTitle,title'||p.title!==p.name)throw Error('Private list-template source unavailable.');
 const fields=privateListTemplateFields({name:p.name,taskTitle:p.taskTitle,checklist:p.checklist});
 if(JSON.stringify(fields)!==JSON.stringify({name:p.name,taskTitle:p.taskTitle,checklist:p.checklist})||!(typeof row.created_at==='string'||row.created_at instanceof Date)||!Number.isFinite(new Date(row.created_at).getTime()))throw Error('Canonical private list-template source required.');
 return structuredClone(row);
}

export function makePrivateListTemplate(fields,ownerId,{idFactory=randomUUID,section='Personal Life'}={}){
 const value=privateListTemplateFields(fields);if(!uuid(ownerId)||typeof idFactory!=='function')throw Error('Verified private template owner required.');
 if(!['Personal Life','Home'].includes(section))throw Error('Supported private template destination required.');
 const id=idFactory();if(!uuid(id))throw Error('Server template identity required.');
 return{id,owner_id:ownerId,household_id:null,visibility:'private',section,item_type:'list_template',origin:LIST_TEMPLATE_ORIGIN,payload:{fictional:true,schemaVersion:1,title:value.name,...value}};
}

export function instantiatePrivateListTemplate(row,ownerId,{day='',taskIdFactory=randomUUID,stepIdFactory=randomUUID}={}){
 const source=privateListTemplateState(row,ownerId),task=makeFictionalTask({title:source.payload.taskTitle,day,section:source.section},ownerId,{allowUndated:true}),id=taskIdFactory();
 if(!uuid(id)||typeof stepIdFactory!=='function')throw Error('Server task identity required.');
 const stepIds=new Set([id.toLowerCase()]);task.id=id;task.origin='PRIVATE_COOKIE_TASK_CREATE';task.payload.subtasks=source.payload.checklist.map(title=>{const stepId=stepIdFactory();if(!uuid(stepId)||stepIds.has(stepId.toLowerCase()))throw Error('Unique server checklist identities required.');stepIds.add(stepId.toLowerCase());return{id:stepId,title,done:false};});
 return task;
}
