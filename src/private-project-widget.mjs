// A bounded title preview over the existing original project overview, not a second reader.
import {escapeHtml as e} from './core.mjs';
import {verifyPrivateProjectOverview} from './private-project-overview.mjs';
import {categoryColorFor} from './private-category-colors.mjs';
export function renderPrivateProjectWidget(widget,value,{now=Date.now(),canRead=false,blocked=false,canBrowse=false,categoryColors={sections:{},items:{}}}={}){
 if(blocked)return'<p role="status">Another action is in progress. Finish or cancel it before opening saved projects.</p>';
 if(!canRead)return'<p role="status">Saved projects are unavailable in this view. Widget settings do not grant project access.</p>';
 if(!value||value.available===false)return'<p role="status">Saved projects are unavailable. Fetch latest to check their source.</p>';
 if(Number.isFinite(value.expiresAt)&&value.expiresAt<=now)return'<p role="status">This project overview expired. Fetch latest before opening a project.</p>';
 try{verifyPrivateProjectOverview(value,{now});}catch{return'<p role="status">Saved projects could not be verified. Fetch latest before opening them.</p>';}
 const bucket=value.widgetProjects?.areas?.[widget.filter],matching=bucket?bucket.rows:value.projects.filter(row=>widget.filter==='all'||row.section===widget.filter),rows=matching.slice(0,widget.limit??6),capped=!bucket&&value.omittedOpenCount>0;
 let html='<p class="tiny muted">Current saved project titles · Checked '+e(new Date(value.checkedAt).toLocaleString())+'. Project status stays under your control.</p>';
 if(bucket)html+='<p>'+bucket.openCount+' open · '+bucket.completedCount+' completed in this area · Showing '+rows.length+' open title(s)</p>';
 else if(widget.filter==='all')html+='<p>'+value.openCount+' open · '+value.completedCount+' completed</p>';
 if(capped)html+='<p class="tiny muted">Filtered preview of the first five open project titles. More matching projects may exist. Browse Projects on Tasks for the complete list.</p>';
 if(rows.length)html+='<ul class="item-list">'+rows.map(row=>'<li class="item" data-category-color="'+(row.displayColor??categoryColorFor({section:row.section,preferences:categoryColors}))+'"><div class="item-main"><strong>'+e(row.title)+'</strong><small>'+e(row.section)+' · '+e(row.projectStatus)+'</small>'+(widget.filter==='Home'&&row.homeAssetSummary?'<small>'+e(row.homeAssetSummary.kind==='vehicle'?'Vehicle':'Possession')+' · '+e(row.homeAssetSummary.label||'Asset')+' · '+(row.homeAssetSummary.latestUsageValue===null?'No usage reading':e(row.homeAssetSummary.latestUsageValue)+' '+e(row.homeAssetSummary.usageUnit))+' · Warranty '+e(row.homeAssetSummary.warrantyEndDay||'not set')+'</small>':'')+'</div><button type="button" class="btn btn-small" data-private-search-project="'+row.projectReadToken+'">Open project<span class="sr-only">: '+e(row.title)+'</span></button></li>').join('')+'</ul>';
 else html+='<p>'+(capped?'No matching project titles in this loaded preview.':'No matching open saved projects.')+'</p>';
 if(rows.length&&rows.length<(bucket?.openCount??matching.length))html+='<p class="tiny muted">Additional project titles are available beyond this widget limit.</p>';
 return html+(canBrowse?'<a class="btn" href="/dev-tasks.html">Browse Projects on Tasks</a>':'');
}
