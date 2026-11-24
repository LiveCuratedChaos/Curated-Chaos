// These choices only select among the existing private editors and their supported areas.
export const QUICK_ADD_LABELS=Object.freeze({task:'Task',event:'Event',note:'Note',grocery:'Grocery item',project:'Project',routine:'Routine'});
const areas=Object.freeze(['context','Home','Personal Life','Work','School']);
export const QUICK_ADD_DESTINATIONS=Object.freeze({task:areas,project:areas,routine:areas,event:['Calendar'],note:['Personal Life'],grocery:['Home']});
const keys=Object.keys(QUICK_ADD_LABELS);
function exact(value,names){
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(name=>Object.hasOwn(value,name));
}
export function defaultQuickAddLayout(){
 return Object.fromEntries(keys.map(kind=>[kind,{destination:QUICK_ADD_DESTINATIONS[kind][0],expanded:false}]));
}
export function validQuickAddEventCategory(value){
 return typeof value==='string'&&value===value.trim()&&value.length>0&&value.length<=48&&value.toLowerCase()!=='all'&&!/[\u0000-\u001f\u007f]/.test(value);
}
export function validateQuickAddLayout(value){
 if(!exact(value,keys))throw Error('Choose Quick Add settings for each record type.');
 const layout={};
 for(const kind of keys){
  const choice=value[kind];
  const category=kind==='event'&&Object.hasOwn(choice??{},'calendarCategory');
  if(category&&!validQuickAddEventCategory(choice.calendarCategory)||!exact(choice,['destination','expanded',...(category?['calendarCategory']:[])])||!QUICK_ADD_DESTINATIONS[kind].includes(choice.destination)||typeof choice.expanded!=='boolean')throw Error('Choose a supported private destination and field layout.');
  layout[kind]={destination:choice.destination,expanded:choice.expanded,...(category?{calendarCategory:choice.calendarCategory}:{})};
 }
 return layout;
}
