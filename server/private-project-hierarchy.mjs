// Explicit selected-project structure context. No external data or arbitrary browser IDs.
import {randomBytes} from 'node:crypto';
import {validateProjectHierarchy,validateHierarchyChange,hierarchyProgress} from '../src/project-hierarchy.mjs';
import {stableStringify} from './stable-json.mjs';
const random=()=>randomBytes(32).toString('base64url');
export function createPrivateProjectHierarchy({api,now=Date.now}={}){
 if(['projectHierarchySnapshot','setProjectHierarchyLink'].some(k=>typeof api?.[k]!=='function'))throw Error('Explicit private project hierarchy API required.');
 const contexts=new Map();let disposed=false;
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);}
 const alive=s=>!disposed&&contexts.get(s.id)===s&&s.expiresAt>now();
 function state(id,actor){const s=contexts.get(id);if(!s||!alive(s)||s.owner!==actor.ownerId)throw Error('Fetch project structure again.');return s;}
 async function snapshot(actor){const value=await api.projectHierarchySnapshot(actor.accessToken,actor.ownerId);if(!value||Object.keys(value).sort().join(',')!=='memberships,projects,relationships,tasks')throw Error('Complete project structure unavailable.');const data={...value,ownerId:actor.ownerId};validateProjectHierarchy(data);return data;}
 const structure=v=>stableStringify({projects:v.projects,relationships:v.relationships});
 async function list(id,actor,expiresAt,selected,{offset=0,query='',direction='children'}={}){
  if(!Number.isInteger(offset)||offset<0||offset>1950||offset%50||typeof query!=='string'||query.length>100||!['children','parents'].includes(direction))throw Error('Supported project structure filters required.');
  clear(id);const s={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),viewId:random(),actions:new Map(),review:null,generation:0};if(disposed||!Number.isFinite(s.expiresAt)||s.expiresAt<=now())throw Error('Active project structure view required.');contexts.set(id,s);s.timer=setTimeout(()=>clear(id),Math.max(1,s.expiresAt-now()));s.timer.unref?.();
  const data=await snapshot(actor);if(!alive(s))throw Error('Project structure view ended.');const root=data.projects.find(p=>p.id===selected.id);if(!root)throw Error('Selected private project unavailable.');
  const summary=hierarchyProgress({...data,rootProjectId:root.id});s.data=data;s.root=root;s.direction=direction;
  const folded=v=>v.normalize('NFKC').toLocaleLowerCase('en-US'),q=folded(query.trim());
  const all=data.projects.filter(p=>p.id!==root.id&&folded(p.payload.title).includes(q)).map(p=>{const parent=direction==='children'?root.id:p.id,child=direction==='children'?p.id:root.id;return{p,linked:data.relationships.some(r=>r.deleted_at===null&&r.payload.parentProjectId===parent&&r.payload.childProjectId===child)};}).sort((a,b)=>Number(b.linked)-Number(a.linked)||a.p.payload.title.localeCompare(b.p.payload.title)||a.p.id.localeCompare(b.p.id));
  if(offset&&offset>=all.length)throw Error('Projects changed; fetch the first page.');
  const projects=all.slice(offset,offset+50).map(({p,linked})=>{const projectToken=random();s.actions.set(projectToken,{project:p,linked});return{projectToken,title:p.payload.title,section:p.section,status:p.payload.status,linked};});
  return{projectTitle:root.payload.title,direction,query:query.trim(),offset,limit:50,matchCount:all.length,viewId:s.viewId,expiresAt:s.expiresAt,projects,progress:summary.progress,descendantCount:summary.projectIds.length-1};
 }
 async function latest(s,actor){const data=await snapshot(actor);if(!alive(s)||structure(data)!==structure(s.data))throw Error('Project structure changed. Fetch latest.');return data;}
 async function prepare(id,actor,projectToken,linked){const s=state(id,actor),choice=s.actions.get(projectToken);s.review=null;const generation=++s.generation;if(!choice||typeof linked!=='boolean'||linked===choice.linked)throw Error('Choose a project relationship change.');const data=await latest(s,actor);if(!alive(s)||s.generation!==generation)throw Error('Structure review changed.');const parentProjectId=s.direction==='children'?s.root.id:choice.project.id,childProjectId=s.direction==='children'?choice.project.id:s.root.id;let change;try{change=validateHierarchyChange(data,{parentProjectId,childProjectId,linked});}catch{const error=Error('A project cannot contain itself through its subprojects.');error.code='PROJECT_HIERARCHY_CYCLE';throw error;}if(change.noChanges)throw Error('Project relationship already changed.');
  const parent=data.projects.find(p=>p.id===parentProjectId),child=data.projects.find(p=>p.id===childProjectId),link=data.relationships.find(r=>r.payload.parentProjectId===parentProjectId&&r.payload.childProjectId===childProjectId)??null;
  const r={id:random(),s,parent,child,link,linked,claimed:false,started:false};s.review=r;return{reviewId:r.id,parentTitle:parent.payload.title,childTitle:child.payload.title,linked,expiresAt:s.expiresAt};
 }
 function claim(id,owner,reviewId){const s=state(id,{ownerId:owner}),r=s.review;if(!r||r.id!==reviewId)throw Error('Structure review ended.');s.review=null;s.actions.clear();s.generation++;r.claimed=true;return r;}
 async function authorize(r,actor){if(!r?.claimed||!alive(r.s)||r.s.owner!==actor.ownerId)return false;await latest(r.s,actor);return alive(r.s);}
 async function save(r,actor){if(!r?.claimed||r.started||!alive(r.s)||r.s.owner!==actor.ownerId)throw Error('Structure review ended.');r.started=true;
  const result=await api.setProjectHierarchyLink(actor.accessToken,{parentProjectId:r.parent.id,parentVersion:r.parent.version,childProjectId:r.child.id,childVersion:r.child.version,linkVersion:r.link?.version??0,linked:r.linked});
  const data=await snapshot(actor);if(!alive(r.s)||result?.parentId!==r.parent.id||result.childId!==r.child.id||result.parentVersion!==r.parent.version+1||result.childVersion!==r.child.version+1)throw Error('Structure save unconfirmed.');
  const parent=data.projects.find(p=>p.id===r.parent.id),child=data.projects.find(p=>p.id===r.child.id),link=data.relationships.find(l=>l.payload.parentProjectId===r.parent.id&&l.payload.childProjectId===r.child.id);
  if(!parent||!child||parent.version!==result.parentVersion||child.version!==result.childVersion||!link||stableStringify(link)!==stableStringify(result.linkRecord)||link.version!==(r.link?.version??0)+1||r.link&&link.id!==r.link.id||(link.deleted_at===null)!==r.linked)throw Error('Structure changed during save verification.');
  clear(r.s.id);return{saved:true,linked:r.linked};
 }
 return{list,prepare,claim,authorize,save,clear,current:(id,key)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).review?.id===key),currentView:(id,key)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===key),dispose(){disposed=true;for(const id of contexts.keys())clear(id);}};
}
