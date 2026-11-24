// One original sparse School overview, shared by independently configured widget instances.
import {escapeHtml as e} from './core.mjs';
import {verifyPrivateSchoolOverview} from './private-school-read.mjs';
export const SCHOOL_WIDGET_TYPES=Object.freeze(['school','degree_progress','courses']);
function prepareSchool(value,now){
 if(!value||value.available===false)return{available:false,reason:'unavailable'};
 if(Number.isFinite(value.expiresAt)&&value.expiresAt<=now)return{available:false,reason:'expired'};
 try{verifyPrivateSchoolOverview(value,{now});}catch{return{available:false,reason:'invalid'};}
 const verified=structuredClone(value),programs=verified.programs.map(row=>({...row,kind:'degree'})),courses=verified.courses.map(row=>({...row,kind:'course'}));
 return{available:true,checkedAt:verified.checkedAt,rows:{school:[...programs,...courses],degree_progress:programs,courses}};
}
function selectSchool(widget,state){
 if(!SCHOOL_WIDGET_TYPES.includes(widget.type))throw Error('Supported School widget required.');if(!state.available)return state;
 const matching=['all','School'].includes(widget.filter)?state.rows[widget.type]:[];return{available:true,count:matching.length,rows:matching.slice(0,widget.limit??6),checkedAt:state.checkedAt};
}
export function schoolWidgetSource(widget,value,{now=Date.now()}={}){return selectSchool(widget,prepareSchool(value,now));}
export function renderPrivateSchoolWidget(widget,value,{now=Date.now(),blocked=false,canRead=false}={}){return renderSchool(widget,prepareSchool(value,now),{blocked,canRead});}
// One immutable verified snapshot per canvas render, not a persistent cache of mutable input.
export function createSchoolWidgetRenderer(value,{now=Date.now(),blocked=false,canRead=false}={}){const state=prepareSchool(value,now);return widget=>renderSchool(widget,state,{blocked,canRead});}
function renderSchool(widget,state,{blocked,canRead}){
 if(blocked)return'<p role="status">Another action is in progress. Finish or cancel it before opening saved School records.</p>';
 const source=selectSchool(widget,state);if(!source.available)return'<p role="status">'+(source.reason==='expired'?'This saved School summary expired. Fetch latest to verify it.':source.reason==='invalid'?'Saved School could not be verified. Fetch latest to check again.':'Saved School is unavailable in this view.')+'</p>'+(canRead?'<a class="btn" href="#private-school-controls">Open saved School controls</a>':'');
 let html='<p class="tiny muted">Saved School · Checked '+e(new Date(source.checkedAt).toLocaleString())+'. Current saved-course progress; no institution was refreshed.</p><p>'+ (source.rows.length<source.count?'Showing '+source.rows.length+' of '+source.count:source.count+' saved record(s)')+'</p>';
 if(!source.rows.length)html+='<p>No matching saved School records.</p>';else html+='<ul class="item-list">'+source.rows.map(row=>'<li class="item"><div class="item-main"><strong>'+e(row.title)+'</strong>'+(row.kind==='degree'?'<small>'+row.done+' of '+row.total+' '+e(row.progressMetric)+' · '+row.percentage+'%</small><progress value="'+row.percentage+'" max="100" aria-label="'+e(row.title)+' progress">'+row.percentage+'%</progress>':'<small>'+e([row.code,row.programTitle,row.status].filter(Boolean).join(' · '))+'</small><small>Official order '+(row.officialOrder??'not set')+' · Study order '+(row.studyOrder??'not set')+'</small>')+'</div>'+(canRead?'<button type="button" class="btn" data-private-school-overview-read="'+row.schoolReadToken+'">Open School record<span class="sr-only">: '+e(row.title)+'</span></button>':'')+'</li>').join('')+'</ul>';
 return html+(canRead?'<a class="btn" href="#private-school-controls">Browse all saved School</a>':'');
}
