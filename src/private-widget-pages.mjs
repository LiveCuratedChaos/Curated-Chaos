// Approved page arrangements share the original private singleton; no source records copied.
import {validatePrivateWidgetLayouts,defaultWidgetLayouts} from './private-widget-layout.mjs';
export const WIDGET_CANVAS_PAGES=Object.freeze(['work','personal','home','school','finances']);
export const WIDGET_PAGE_TITLES=Object.freeze({curation:'The Curation',brief:'Daily Brief',calendar:'Calendar',school:'School',work:'Work',finances:'Finances',personal:'Personal Life',home:'Home & Household'});
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.slice().sort().join(',');
export function widgetPage(value){if(typeof value!=='string'||!Object.hasOwn(WIDGET_PAGE_TITLES,value))throw Error('Choose a supported page.');return value;}
export function defaultPageWidgetLayouts(page){
 widgetPage(page);if(page==='curation')return defaultWidgetLayouts();if(page==='brief'||page==='calendar')return{desktop:[],tablet:[],phone:[]};
 const definitions={calendar:['schedule','tasks'],school:['degree_progress','courses','tasks'],work:['tasks','projects','clock'],finances:['bills'],personal:['tasks','notes','schedule','projects'],home:['tasks','household','notes','projects']},area={school:'School',work:'Work',personal:'Personal Life',home:'Home'};
 return Object.fromEntries(['desktop','tablet','phone'].map(device=>[device,definitions[page].map((type,index)=>({id:page+'-'+device+'-'+type+'-'+(index+1),type,width:device==='desktop'?'half':'full',hidden:false,filter:['tasks','projects'].includes(type)?(area[page]??'all'):'all',...(page==='personal'&&type==='projects'?{title:'Goals & projects'}:page==='home'&&type==='projects'?{title:'Home projects'}:{})}))]));
}
export function validateWidgetPages(value){
 if(!exact(value,['schemaVersion','pages'])||value.schemaVersion!==1||!value.pages||typeof value.pages!=='object'||Array.isArray(value.pages)||Object.keys(value.pages).some(page=>page==='curation'||!Object.hasOwn(WIDGET_PAGE_TITLES,page)))throw Error('Supported exact page arrangements required.');
 for(const entry of Object.values(value.pages)){if(!exact(entry,['layouts']))throw Error('Supported page settings required.');validatePrivateWidgetLayouts(entry.layouts);}
 const associationTypes=new Map();for(const entry of Object.values(value.pages))for(const list of Object.values(entry.layouts))for(const widget of list)if(widget.sourceAssociationId){const prior=associationTypes.get(widget.sourceAssociationId);if(prior&&prior!==widget.type)throw Error('A source alias cannot cross widget types.');associationTypes.set(widget.sourceAssociationId,widget.type);}return value;
}
export function selectedPageWidgetLayout(payload,page){
 widgetPage(page);if(Object.hasOwn(payload,'pageLayouts'))validateWidgetPages(payload.pageLayouts);
 if(page==='curation')return{layouts:validatePrivateWidgetLayouts(payload.layouts),configured:true};
 const entry=payload.pageLayouts?.pages[page];return{layouts:entry?validatePrivateWidgetLayouts(entry.layouts):defaultPageWidgetLayouts(page),configured:Boolean(entry)};
}
export function applyPageWidgetLayout(payload,page,layouts){
 widgetPage(page);const valid=validatePrivateWidgetLayouts(layouts),result=structuredClone(payload);if(Object.hasOwn(result,'pageLayouts'))validateWidgetPages(result.pageLayouts);
 if(page==='curation')result.layouts=valid;else{result.pageLayouts??={schemaVersion:1,pages:{}};result.pageLayouts.pages[page]={layouts:valid};}return result;
}
