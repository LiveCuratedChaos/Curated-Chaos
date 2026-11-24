import {validWidgetSourceRead} from './private-project-widget-source.mjs';
import {categoryColorFor} from './private-category-colors.mjs';
import {validDay} from './dev-brief-model.mjs';
import {renderPrivateProjectWidget} from './private-project-widget.mjs';
import {SCHOOL_WIDGET_TYPES,createSchoolWidgetRenderer} from './private-school-widget.mjs';
import {renderPrivateClock} from './private-clock-widget.mjs';
import {verifyCurationWidgetSources} from './private-curation-sources.mjs';
// Saved arrangements over existing authorized title/action summaries; no data fetches or writes.
import {escapeHtml as e} from './core.mjs';
import {validatePrivateWidgetLayouts,FINANCE_WIDGET_TYPES,WIDGET_TYPES,DASHBOARD_DEVICES,TASK_FILTERS} from './private-widget-layout.mjs';
const types=new Map(WIDGET_TYPES.map(w=>[w.id,w]));
const searchSections=new Map(TASK_FILTERS.map(area=>['#workspace-search-'+area.toLowerCase().replaceAll(' ','-'),area]));
export const widgetSearchSection=fragment=>searchSections.get(fragment)??null;
export function curationDevice(width){return Number.isFinite(width)&&width<680?'phone':Number.isFinite(width)&&width<1020?'tablet':'desktop';}
export function curationWidgetSource(widget,data){
 if(widget.type==='coming_up'){
  if(!data?.widgetSources)return{available:false};const sources=verifyCurationWidgetSources(data.widgetSources),tasks=sources.futureTasks?.[widget.filter],events=sources.futureSchedule?.[widget.filter];if(!tasks||!events)return{available:false};if(tasks.count+events.count>2000)throw Error('Bounded complete future inventory required.');
  if(!validDay(data.day)||[...tasks.rows,...events.rows].some(row=>!row.day||row.day<=data.day))throw Error('Future widget titles must follow the selected Brief day.');
  const rows=[...tasks.rows.map(row=>({...row,widgetKind:'task'})),...events.rows.map(row=>({...row,widgetKind:'event'}))].sort((a,b)=>a.day.localeCompare(b.day)||(a.widgetKind==='event'?a.time:'').localeCompare(b.widgetKind==='event'?b.time:'')||a.title.localeCompare(b.title));return{available:true,rows:rows.slice(0,widget.limit??6),total:tasks.count+events.count,filteredPreview:false};
 }

 if(data&&Object.hasOwn(data,'widgetSources')){const sources=verifyCurationWidgetSources(data.widgetSources),bucket=sources[widget.type==='priority_tasks'?'priorityTasks':widget.type]?.[widget.filter];return bucket?{available:true,rows:bucket.rows.slice(0,widget.limit??6),total:bucket.count,filteredPreview:false}:{available:false};}
 const groups=widget.type==='tasks'?['dueTasks','upcomingTasks',...(Array.isArray(data?.undatedTasks)?['undatedTasks']:[])]:widget.type==='schedule'?['eventsToday','upcomingEvents']:widget.type==='notes'?['notes']:null;
 if(!groups)return{available:false};
 if(!data?.counts||groups.some(key=>!Array.isArray(data[key])||!Number.isInteger(data.counts[key])||data.counts[key]<data[key].length||data[key].some(r=>typeof r?.title!=='string'||!r.title.trim()||r.title.length>200)))throw Error('Complete saved widget source required.');
 const rows=groups.flatMap(key=>data[key]),sourceCount=groups.reduce((sum,key)=>sum+data.counts[key],0),capped=rows.length<sourceCount;
 if(widget.filter!=='all'&&rows.some(r=>!['Home','Personal Life','Work','School','Calendar','Finances'].includes(r.section)))return{available:false,filterUnavailable:true};
 const matching=widget.filter==='all'?rows:rows.filter(r=>r.section===widget.filter);
 return{available:true,rows:matching.slice(0,widget.limit??6),total:widget.filter==='all'?sourceCount:matching.length,filteredPreview:widget.filter!=='all'&&capped};
}
export function renderPrivateCuration({layouts,pageTitle='The Curation',device='desktop',data,expiresAt,now=Date.now(),renderList,links={},searchEnabled=false,searchBlocked=false,scopedSearch=false,schoolReadEnabled=false,schoolBlocked=false,briefRenderer=null,projectReadEnabled=false,projectBlocked=false,financeRenderer=null,emailRenderer=null,favoritesRenderer=null,categoryColors={sections:{},items:{}}}){
 if(!DASHBOARD_DEVICES.includes(device)||typeof renderList!=='function')throw Error('Explicit Curation screen and original action renderer required.');
 const saved=validatePrivateWidgetLayouts(layouts);
 if(!Number.isFinite(expiresAt)||expiresAt<=now)return'<section class="panel" aria-label="'+e(pageTitle)+' widgets"><p role="status">Saved widget view expired. Fetch latest to check the current arrangement.</p></section>';
 const widgets=saved[device].filter(w=>!w.hidden),renderSchool=widgets.some(w=>SCHOOL_WIDGET_TYPES.includes(w.type))?createSchoolWidgetRenderer(data?.schoolOverview,{now,canRead:schoolReadEnabled,blocked:schoolBlocked}):null;let html='<section aria-label="'+e(pageTitle)+' widgets"><p class="tiny muted">'+e(device)+' arrangement · Saved workspace titles and actions. Widget settings do not grant source access.</p><div class="cc-widget-grid">';
 for(const widget of widgets){const type=types.get(widget.type),source=(['notes','projects'].includes(widget.type)&&widget.sourceAssociationId)?{available:true,rows:[],total:1}:curationWidgetSource(widget,data);let body='';
  if((widget.type==='notes'||widget.type==='projects')&&widget.sourceAssociationId){const source=(data?.associatedSources??data?.widgetSources)?.[widget.sourceAssociationId],expected=widget.type==='notes'?'note':'project';if(source?.type!==expected||!validWidgetSourceRead(source,expiresAt,now))body='<p role="status">This linked '+(expected==='note'?'note':'project')+' is unavailable or expired. Fetch latest to check its current source.</p>';else body='<p class="tiny muted">Linked saved '+expected+' · '+e(source.section)+(expected==='project'?' · '+e(source.status):'')+'</p><p class="linked-widget-title" data-category-color="'+e(source.displayColor??categoryColorFor({section:source.section,preferences:categoryColors}))+'"><strong>'+e(source.title)+'</strong></p><button type="button" class="btn btn-small" '+(expected==='note'?'data-private-note="'+e(source.noteToken)+'"':'data-private-search-project="'+e(source.projectReadToken)+'"')+'>'+('Open '+expected)+'</button>'+(source.recordToken?'<button type="button" class="btn btn-small" data-private-record-review="'+e(source.recordToken)+'">Review removal</button>':'');}
  else if(FINANCE_WIDGET_TYPES.includes(widget.type))body=financeRenderer?financeRenderer(widget):'<p role="status">This financial source is unavailable.</p>';
  else if(widget.type==='search'){
   const label=widget.filter==='all'?'Search saved titles':'Search saved titles in '+e(widget.filter);
   if(!searchEnabled)body='<p role="status">Workspace search is unavailable.</p>';
   else if(scopedSearch&&!searchBlocked)body='<a class="btn" href="/dev-dashboard.html#workspace-search-'+widget.filter.toLowerCase().replaceAll(' ','-')+'">'+label+'</a>';
   else body='<button type="button" class="btn" data-private-widget-search="'+e(widget.id)+'"'+(searchBlocked?' disabled':'')+'>'+label+'</button>';
  }
  else if(widget.type==='favorites')body=favoritesRenderer?favoritesRenderer(widget):'<p role="status">Favorites are unavailable in this workspace.</p>';
  else if(widget.type==='email')body=typeof emailRenderer==='function'?emailRenderer(widget):'<p role="status">Saved email is unavailable. Widget settings do not grant email access.</p>';
  else if(widget.type==='projects')body=renderPrivateProjectWidget(widget,data?.projectOverview,{now,canRead:projectReadEnabled,blocked:projectBlocked,canBrowse:Boolean(links.tasks),categoryColors});
  else if(SCHOOL_WIDGET_TYPES.includes(widget.type))body=renderSchool(widget);
  else if(widget.type==='clock')body='<div data-private-curation-clock="'+e(widget.id)+'" aria-live="off">'+renderPrivateClock(widget,{now})+'</div>';
  else if(widget.type==='brief')body=(typeof briefRenderer==='function'?briefRenderer():'<p>Open your saved Daily Brief for its schedule, priorities and permitted summaries.</p>')+'<a class="btn" href="/dev-dashboard.html">Open Daily Brief</a>';
  else if(!source.available)body='<p role="status">'+(source.filterUnavailable?'The area filter cannot be verified for this saved title preview.':'This widget source is unavailable in this view. Its saved settings are kept.')+'</p>';
  else{body=widget.type==='coming_up'?'<p class="tiny muted">Saved tasks and workspace events after '+e(data.day)+'. Other domain sources are not included in this view.</p>':widget.type==='priority_tasks'?'<p class="tiny muted">Open tasks marked High or Urgent. Unverified priorities and suggested emails are not included.</p>':'';body+=source.filteredPreview?'<p class="tiny muted">Filtered preview of loaded titles. More matching saved items may exist in the complete workspace.</p>':'';body+=source.rows.length?renderList(source.rows,source.total,['priority_tasks','coming_up'].includes(widget.type)?'tasks':widget.type):'<p>'+(source.filteredPreview?'No matching titles in this loaded preview.':'No matching saved items.')+'</p>';const route=['tasks','priority_tasks','coming_up'].includes(widget.type)&&links.tasks?'/dev-tasks.html':widget.type==='schedule'&&links.calendar?'/dev-calendar.html':widget.type==='notes'&&links.notes?'/dev-notes.html':null;if(widget.type==='coming_up'&&links.calendar)body+='<a class="btn" href="/dev-calendar.html">Browse all calendar events</a>';if(route)body+='<a class="btn" href="'+route+'">Browse all '+(widget.type==='schedule'?'calendar events':['priority_tasks','coming_up'].includes(widget.type)?'tasks':widget.type)+'</a>';}
  html+='<article class="cc-work-card cc-widget-card '+(widget.width==='full'?'cc-widget-full':'')+'" data-private-curation-widget="'+e(widget.id)+'" aria-label="'+e(widget.title||type.title)+'"><h2>'+e(widget.title||type.title)+'</h2>'+body+'</article>';
 }
 if(!widgets.length)html+='<p>No widgets are visible for this screen. Customize The Curation to add or show widgets.</p>';
 return html+'</div></section>';
}

export function verifyCurationData(data){if(data&&Object.hasOwn(data,'widgetSources'))verifyCurationWidgetSources(data.widgetSources);else for(const type of ['tasks','schedule','notes'])curationWidgetSource({type,filter:'all',limit:10},data);return data;}
