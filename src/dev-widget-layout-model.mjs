import {CLOCK_MODES,renderPrivateClock} from './private-clock-widget.mjs';
// Milestone 2B — fictional, owner-private widget arrangements.
// Display settings cannot grant database permissions; source records remain read-only.
import {escapeHtml as e} from './core.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DASHBOARD_DEVICES=Object.freeze(['desktop','tablet','phone']);
export const TASK_FILTERS=Object.freeze(['all','Home','Personal Life','Work','School']);
export const FINANCE_WIDGET_TYPES=Object.freeze(['bills','budget','investments']);
export const WIDGET_TYPES=Object.freeze([
  {id:'degree_progress',title:'Degree Progress',desc:'Current progress from permitted saved School programs.',href:'/dev-school.html'},
  {id:'courses',title:'Courses & Assessments',desc:'Saved courses and original assessment details.',href:'/dev-school.html'},
  {id:'favorites',title:'Favorites',desc:'Open favorite pages, notes, tasks, projects and events.',href:'/dev-dashboard.html'},
  {id:'clock',title:'Clock',desc:'Current device local time, analog or digital.',href:'/dev-dashboard.html'},
  {id:'brief',title:'A Glimpse of Your Day',desc:'Open your connected Daily Brief.',href:'/dev-dashboard.html'},
  {id:'coming_up',title:'Coming Up',desc:'Future saved tasks and workspace events after the selected Brief date.',href:'/dev-dashboard.html'},
  {id:'priority_tasks',title:'Priority Tasks',desc:'Open tasks marked High or Urgent; email suggestions require separate approval.',href:'/dev-tasks.html'},
  {id:'tasks',title:'Tasks',desc:'Saved private test tasks, by section.',href:'/dev-tasks.html'},
  {id:'schedule',title:'Calendar Today & Upcoming',desc:'Fictional calendar events.',href:'/dev-agenda.html'},
  {id:'school',title:'School Reminders',desc:'Saved fictional assessments and study blocks.',href:'/dev-life.html'},
  {id:'budget',title:'Budget',desc:'Saved spending and the amount left this month.',href:'/dev-finances.html'},
  {id:'investments',title:'Investments',desc:'Saved holdings and dated valuations.',href:'/dev-finances.html'},
  {id:'bills',title:'Bills',desc:'Fictional upcoming bills; amounts hidden by default.',href:'/dev-life.html'},
  {id:'household',title:'Household',desc:'Fictional cleaning and maintenance.',href:'/dev-life.html'},
  {id:'notes',title:'Notes',desc:'Your private fictional test notes.',href:'/dev-notes.html'},
  {id:'projects',title:'Projects',desc:'Owner-private fictional projects.',href:'/dev-organize.html#projects'},
  {id:'email',title:'Email Insights',desc:'Prepared fictional emails; no real inbox access.',href:'/dev-email.html'}
]);
const typeById=Object.fromEntries(WIDGET_TYPES.map(t=>[t.id,t]));
const base=[['brief','full'],['tasks','half'],['schedule','half'],['school','half'],['bills','half'],['household','half'],['notes','half']];
export const MAX_WIDGETS=20;
const template=(types,device)=>types.map(([type,width],i)=>({id:`${device}-${type}-${i+1}`,type,width,hidden:false,filter:'all'}));
export function defaultWidgetLayouts(){return {desktop:template(base,'desktop'),tablet:template(base.map(([t])=>[t,'full']),'tablet'),phone:template(base.filter(([t])=>t!=='notes').map(([t])=>[t,'full']),'phone')};}
export function normalizeWidgetLayouts(raw){
  const defaults=defaultWidgetLayouts(),source=raw&&typeof raw==='object'?raw:{};
  return Object.fromEntries(DASHBOARD_DEVICES.map(device=>{
    if(!Array.isArray(source[device]))return [device,defaults[device]];
    const ids=new Set();const result=[];
    for(const entry of source[device].slice(0,MAX_WIDGETS)){
      if(!entry||!typeById[entry.type]||typeof entry.id!=='string'||! /^[A-Za-z0-9_-]{3,70}$/.test(entry.id)||ids.has(entry.id))continue;
      ids.add(entry.id);const item={id:entry.id,type:entry.type,width:entry.width==='full'?'full':'half',hidden:entry.hidden===true,filter:TASK_FILTERS.includes(entry.filter)?entry.filter:'all'};
      if(typeof entry.title==='string'&&entry.title.trim())item.title=entry.title.trim().slice(0,50);
      if([2,4,6,10].includes(entry.limit))item.limit=entry.limit;
      if(item.type==='clock'&&CLOCK_MODES.includes(entry.clockMode))item.clockMode=entry.clockMode;
      if(['notes','projects'].includes(item.type)&&typeof entry.sourceAssociationId==='string'&&UUID.test(entry.sourceAssociationId))item.sourceAssociationId=entry.sourceAssociationId;
      if(FINANCE_WIDGET_TYPES.includes(item.type))for(const key of ['showAmounts','showPercentages']){
        if(typeof entry[key]==='boolean')item[key]=entry[key];
      }
      result.push(item);
    }
    return [device,result];
  }));
}
export function makeWidgetLayoutRecord(layouts,ownerId){
  if(!UUID.test(ownerId||''))throw Error('Verified test account required to save widget layouts.');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'dashboard_layout',origin:'M2B_DEV_WIDGETS',payload:{fictional:true,source:'M2B_DEV_WIDGETS',layoutVersion:1,layouts:normalizeWidgetLayouts(layouts)}};
}
export function readOwnerWidgetLayout(rows,ownerId){
  const valid=(Array.isArray(rows)?rows:[]).filter(row=>row?.owner_id===ownerId&&row?.deleted_at==null&&row?.household_id===null&&row?.visibility==='private'&&row?.item_type==='dashboard_layout'&&row?.payload?.fictional===true&&row?.payload?.source==='M2B_DEV_WIDGETS'&&row?.origin==='M2B_DEV_WIDGETS'&&Number.isInteger(row?.version)&&row.version>=1);
  valid.sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))||String(b.id).localeCompare(String(a.id)));
  return {record:valid[0]||null,layouts:normalizeWidgetLayouts(valid[0]?.payload?.layouts),duplicateCount:Math.max(0,valid.length-1)};
}
export function editWidgetLayouts(raw,device,action,widgetId,arg,newId){
  if(!DASHBOARD_DEVICES.includes(device))throw Error('Unsupported screen layout.');
  const layouts=normalizeWidgetLayouts(raw);const list=layouts[device];const index=list.findIndex(w=>w.id===widgetId);
  if(action==='add'){
    if(!typeById[arg]||list.length>=MAX_WIDGETS||typeof newId!=='string'||! /^[A-Za-z0-9_-]{3,70}$/.test(newId)||list.some(w=>w.id===newId))throw Error('Could not add that widget.');
    list.push({id:newId,type:arg,width:device==='desktop'?'half':'full',hidden:false,filter:'all'});
  }else{
    if(index<0)throw Error('Widget no longer exists in this layout.');
    const item=list[index];
    if(action==='up' && index>0)[list[index-1],list[index]]=[item,list[index-1]];
    else if(action==='down' && index<list.length-1)[list[index],list[index+1]]=[list[index+1],item];
    else if(action==='hide')item.hidden=!item.hidden;
    else if(action==='size' && ['half','full'].includes(arg))item.width=arg;
    else if(action==='filter' && TASK_FILTERS.includes(arg))item.filter=arg;
    else if(action==='title' && typeof arg==='string'){const title=arg.trim().slice(0,50);if(title)item.title=title;else delete item.title;}
    else if(action==='limit' && [2,4,6,10].includes(Number(arg)))item.limit=Number(arg);
    else if(['showAmounts','showPercentages'].includes(action)&&FINANCE_WIDGET_TYPES.includes(item.type)&&typeof arg==='boolean')item[action]=arg;
    else if(action==='clockMode'&&item.type==='clock'&&CLOCK_MODES.includes(arg))item.clockMode=arg;
    else if(action==='remove')list.splice(index,1);
    else if(action==='duplicate'){
      if(list.length>=MAX_WIDGETS||typeof newId!=='string'||! /^[A-Za-z0-9_-]{3,70}$/.test(newId)||list.some(w=>w.id===newId))throw Error('Cannot duplicate widget.');
      list.splice(index+1,0,{...item,id:newId,hidden:false});
    }else if(!['up','down'].includes(action))throw Error('Unsupported widget edit.');
  }
  return layouts;
}
export function moveWidgetBetween(raw,device,sourceId,targetId){
  const layouts=normalizeWidgetLayouts(raw),list=layouts[device];if(!list)throw Error('Unknown layout.');
  const a=list.findIndex(x=>x.id===sourceId),b=list.findIndex(x=>x.id===targetId);
  if(a<0||b<0||a===b)return layouts;
  list.splice(b,0,list.splice(a,1)[0]);return layouts;
}
function widgetRows(widget,snapshot,hideAmounts=true){
  const tasks=(snapshot?.tasks||[]).filter(r=>widget.filter==='all'||r.section===widget.filter);
  const life=snapshot?.life||[];
  switch(widget.type){
    case 'priority_tasks':return tasks.filter(r=>r.payload?.done===false&&['High','Urgent'].includes(r.payload.priority)).sort((a,b)=>(a.payload.priority==='Urgent'?0:1)-(b.payload.priority==='Urgent'?0:1)).slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.payload.priority,r.section,r.payload.day].filter(Boolean).join(' · ')}));
    case 'tasks':return tasks.slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.section,r.payload.day,r.payload.done?'Complete':'To do'].filter(Boolean).join(' · ')}));
    case 'schedule':return (snapshot?.events||[]).slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.payload.day,r.payload.time].filter(Boolean).join(' · ')}));
    case 'school':return life.filter(r=>r.item_type==='school_fixture').slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.payload.day,r.payload.kind].filter(Boolean).join(' · ')}));
    case 'bills':return life.filter(r=>r.item_type==='bill_fixture').slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.payload.day,'Fictional bill',(!hideAmounts&&Number.isFinite(r.payload.amount))?Number(r.payload.amount).toLocaleString('en-US',{style:'currency',currency:'USD'}):null].filter(Boolean).join(' · ')}));
    case 'household':return life.filter(r=>r.item_type==='household_fixture').slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.payload.day,r.payload.kind].filter(Boolean).join(' · ')}));
    case 'projects':return (snapshot?.projects||[]).slice(0,10).map(r=>({title:r.payload.title,subtitle:[r.section,r.payload.status||'Planned'].join(' · ')}));
    case 'notes':return (snapshot?.notes||[]).slice(0,10).map(r=>({title:r.payload.title,subtitle:'Private test note'}));
    case 'email':return (snapshot?.emails||[]).slice(0,10).map(r=>({title:r.payload.subject,subtitle:'Saved fictional email'}));
    default:return [];
  }
}
function renderOneWidget(w,index,total,snapshot,editing,hideAmounts){
  const t=typeById[w.type];if(!t)return '';
  if(w.hidden&&!editing)return '';
  const rows=widgetRows(w,snapshot,hideAmounts).slice(0,w.limit||6),isBrief=w.type==='brief';
  const content=w.type==='favorites'?'<p>Open the private workspace to view your favorites.</p>':w.type==='coming_up'?'<p>Coming Up is unavailable in this legacy widget view. Open your private Daily Brief to check current sources.</p>':['degree_progress','courses'].includes(w.type)?'<p>Saved School is unavailable in this legacy widget view. Open School to check its original records.</p>':w.type==='clock'?'<div data-private-curation-clock="'+e(w.id)+'" aria-live="off">'+renderPrivateClock(w)+'</div>':isBrief?'<p class="cc-widget-description">Your verified Milestone 1 Daily Brief is one click away. No duplicate AI summary is generated here.</p>':rows.length?`<ul class="cc-work-list">${rows.map(r=>`<li class="cc-work-item"><strong>${e(r.title)}</strong><small>${e(r.subtitle)}</small></li>`).join('')}</ul>`:'<p class="empty">No saved fictional records for this widget.</p>';
  const controls=editing?`<div class="cc-widget-controls"><div class="cc-widget-buttons"><button type="button" data-widget-action="up" data-widget-id="${e(w.id)}" ${index===0?'disabled':''} title="Move earlier">↑ Up</button><button type="button" data-widget-action="down" data-widget-id="${e(w.id)}" ${index===total-1?'disabled':''} title="Move later">↓ Down</button><button type="button" data-widget-action="duplicate" data-widget-id="${e(w.id)}">Duplicate</button><button type="button" data-widget-action="hide" data-widget-id="${e(w.id)}">${w.hidden?'Show':'Hide'}</button><button type="button" data-widget-action="remove" data-widget-id="${e(w.id)}">Remove</button></div><div class="cc-widget-options"><label>Width <select data-widget-size="${e(w.id)}"><option value="half" ${w.width==='half'?'selected':''}>Half</option><option value="full" ${w.width==='full'?'selected':''}>Full</option></select></label><label>Items to show <select data-widget-limit="${e(w.id)}">${[2,4,6,10].map(n=>`<option value="${n}" ${(w.limit||6)===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Custom title <input data-widget-title="${e(w.id)}" maxlength="50" placeholder="${e(t.title)}" value="${e(w.title||'')}"></label>${['tasks','priority_tasks'].includes(w.type)?`<label>Tasks section <select data-widget-filter="${e(w.id)}">${TASK_FILTERS.map(f=>`<option value="${e(f)}" ${w.filter===f?'selected':''}>${e(f==='all'?'All sections':f)}</option>`).join('')}</select></label>`:''}</div></div>`:'';
  return `<article class="cc-work-card cc-widget-card ${w.width==='full'?'cc-widget-full':''} ${w.hidden?'cc-widget-hidden':''}" data-widget-card="${e(w.id)}" ${editing?'draggable="true"':''}><div class="cc-card-heading"><h2>${e(w.title||t.title)}</h2><span class="pill">${w.hidden?'Hidden':(w.type==='clock'?'Device time':w.type==='brief'?'Connected':'Saved data')}</span></div>${content}${w.type==='clock'?'':`<a class="cc-work-action" href="${e(t.href)}">Open ${e(t.title)} →</a>`}${controls}</article>`;
}
export function renderWidgetBoard(layouts,device,snapshot,{editing=false,dirty=false,loading=false,saveBlocked=false,duplicateCount=0,hideAmounts=true}={}){
  const saved=normalizeWidgetLayouts(layouts),widgets=saved[DASHBOARD_DEVICES.includes(device)?device:'desktop'];
  const visible=widgets.filter(w=>!w.hidden).length;
  const chips=DASHBOARD_DEVICES.map(d=>`<button type="button" data-layout-device="${d}" class="${device===d?'selected':''}" aria-pressed="${device===d}">${d==='phone'?'Phone':d[0].toUpperCase()+d.slice(1)}</button>`).join('');
  return `<section class="cc-widget-studio" aria-label="The Curation widget studio"><div class="cc-widget-toolbar"><div><h2>My Curation</h2><p>Choose a screen layout, then add, reorder, resize, rename or hide widgets. Source records never change.</p></div><div class="cc-widget-toolbar-actions"><button type="button" id="widgets-edit">${editing?'Done editing':'Customize dashboard'}</button>${dirty?'<button type="button" id="widgets-discard">Discard draft</button>':''}<button type="button" class="btn btn-primary" id="widgets-save" ${!dirty||loading||saveBlocked?'disabled':''}>${loading?'Saving…':'Save layout'}</button></div></div><div class="cc-widget-presetbar"><span>Layout for</span><div class="cc-widget-devices" role="group" aria-label="Dashboard screen layouts">${chips}</div><span class="cc-widget-count">${visible} visible · ${widgets.length} total ${dirty?'· Unsaved changes':''}</span></div>${duplicateCount?'<p role="alert" class="warning">Several older widget layouts exist for this test account. The most recently updated was loaded; this development database does not yet enforce one layout per owner.</p>':''}${editing?`<section class="cc-widget-library"><h3>Add a widget</h3><div class="cc-widget-library-items">${WIDGET_TYPES.map(t=>`<button type="button" data-widget-add="${t.id}" ${widgets.length>=MAX_WIDGETS?'disabled':''}>+ ${e(t.title)}</button>`).join('')}</div><p class="tiny muted">You can add more than one of the same widget. Drag cards to reorder on desktop, or use Up and Down buttons. Save to keep changes.</p></section>`:''}<div class="cc-widget-grid">${widgets.map((w,i)=>renderOneWidget(w,i,widgets.length,snapshot,editing,hideAmounts)).join('')||'<p class="empty">No visible widgets. Choose Customize dashboard to show existing widgets or add a new one.</p>'}</div><p class="tiny muted">Layouts are private to your development test account. Desktop, tablet, and phone arrangements are stored separately. These widgets show fictional test records only. The layout is shared between signed-in devices using the same test account; full live integrations are not active.</p></section>`;
}
