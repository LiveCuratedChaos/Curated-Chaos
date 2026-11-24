import {CATEGORY_COLOR_TOKENS} from './private-category-colors.mjs';
// Resolve an associated project widget only while its current canvas/source view is live.
const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const areas=['Home','Personal Life','Work','School'];
const statuses=['Active','Planned','On hold','Completed'];

export function validWidgetSourceRead(source,layoutExpiry,now){
 if(!source||!['note','project'].includes(source.type)||typeof source.title!=='string'||!source.title.trim()||source.title.length>200
  ||!Number.isFinite(source.expiresAt)||source.expiresAt<=now||source.expiresAt>layoutExpiry)return false;
 const keys=['type','title','section','expiresAt'];
 if(Object.hasOwn(source,'displayColor')){
  if(!CATEGORY_COLOR_TOKENS.includes(source.displayColor))return false;
  keys.push('displayColor');
 }
 if(Object.hasOwn(source,'recordToken')){
  if(!token(source.recordToken))return false;
  keys.push('recordToken');
 }
 if(source.type==='project')return areas.includes(source.section)&&statuses.includes(source.status)&&token(source.projectReadToken)&&exact(source,[...keys,'status','projectReadToken']);
 return source.section==='Personal Life'&&token(source.noteToken)&&exact(source,[...keys,'noteToken']);
}

export function currentProjectWidgetSource(projectReadToken,{layouts,device,sources,canvasActive=false,expiresAt,now=Date.now()}={}){
 if(!canvasActive||!token(projectReadToken)||!Number.isFinite(expiresAt)||expiresAt<=now||!Array.isArray(layouts?.[device]))return null;
 for(const widget of layouts[device]){
  if(widget?.hidden||widget.type!=='projects'||typeof widget.sourceAssociationId!=='string')continue;
  const source=sources?.[widget.sourceAssociationId];
  if(!validWidgetSourceRead(source,expiresAt,now)||source.type!=='project'||source.projectReadToken!==projectReadToken)continue;
  return{type:'project',projectReadToken, title:source.title,section:source.section,projectStatus:source.status};
 }
 return null;
}
