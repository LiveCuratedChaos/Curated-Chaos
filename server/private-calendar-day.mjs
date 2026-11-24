import {appliedCalendarFilters} from '../src/private-calendar-filters.mjs';
// Separate selected-day reader. Internal editor validation is never write authority.
import {randomBytes} from 'node:crypto';
import {createPrivateEventEdits} from './private-event-edits.mjs';
import {privateWorkspaceSearch} from './private-workspace-search.mjs';
import {validateCalendarDayFields,verifyCalendarDay} from '../src/private-calendar-day.mjs';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const random=()=>randomBytes(32).toString('base64url');
export function createPrivateCalendarDay({api,now=Date.now,allowAllDay=false,allowRanges=false,readColors=null}={}){
 if(typeof now!=='function'||typeof allowAllDay!=='boolean'||typeof allowRanges!=='boolean'||['listPrivateBriefRecords','getPrivateEvent'].some(key=>typeof api?.[key]!=='function'))throw Error('Explicit private Calendar day read API required.');
 const contexts=new Map(),reader=createPrivateEventEdits({api:{getPrivateEvent:(...args)=>api.getPrivateEvent(...args)},now,allowDetails:true,allowAllDay,allowRanges});let disposed=false;
 const alive=state=>!disposed&&contexts.get(state.id)===state&&state.expiresAt>now();
 function clear(id){clearTimeout(contexts.get(id)?.timer);contexts.delete(id);reader.clear(id);}
 function state(id,actor){const selected=contexts.get(id);if(!selected||!alive(selected)||selected.owner!==actor?.ownerId)throw Error('Fetch the Calendar day again.');return selected;}
 async function list(id,actor,expiresAt,values){
  const fields=validateCalendarDayFields(values),filters=appliedCalendarFilters(fields);
  if(disposed||typeof id!=='string'||!id||!uuid(actor?.ownerId)||!Number.isFinite(expiresAt)||expiresAt<=now())throw Error('Active Calendar day context required.');
  clear(id);const selected={id,owner:actor.ownerId,expiresAt:Math.min(expiresAt,now()+300000),viewId:random(),tokens:new Set()};contexts.set(id,selected);selected.timer=setTimeout(()=>{if(contexts.get(id)===selected)clear(id);},Math.max(1,selected.expiresAt-now()));selected.timer.unref?.();
  try{
   const [rows,display]=await Promise.all([api.listPrivateBriefRecords(actor.accessToken,actor.ownerId),readColors?.(actor).catch(()=>null)]);if(!alive(selected))throw Error('Calendar day view ended.');
   const issue=reader.begin(id,actor.ownerId,selected.expiresAt,50),result=privateWorkspaceSearch({rows,ownerId:actor.ownerId,now:now(),values:{...filters,query:fields.query,type:'event',section:'Calendar',status:'all',dateFrom:fields.day,dateTo:fields.day,offset:fields.offset},includeDates:true,eventOrderByTime:true,recordAction:display,eventAction:issue});
   const events=result.results.map(({eventEditToken,eventSource,eventCategory,householdVisible,...event})=>({...event,...(Object.keys(filters).length?{eventSource,eventCategory,householdVisible}:{}),eventReadToken:eventEditToken})),response={...fields,limit:result.limit,matchCount:result.matchCount,omittedRecords:result.omittedRecords,dateRangeUnavailableRecords:result.dateRangeUnavailableRecords,checkedAt:result.checkedAt,expiresAt:selected.expiresAt,events,readOnly:true,providerRead:false,viewId:selected.viewId};
   verifyCalendarDay(response,fields,{now:now()});if(!alive(selected))throw Error('Calendar day view ended.');selected.tokens=new Set(events.map(event=>event.eventReadToken));return response;
  }catch(error){if(contexts.get(id)===selected)clear(id);throw error;}
 }
 async function read(id,actor,eventReadToken){
  const selected=state(id,actor);if(!selected.tokens.has(eventReadToken)||!reader.hasAction(id,eventReadToken))throw Error('Choose a displayed event from this Calendar day.');
  const result=await reader.read(id,actor,eventReadToken);
  if(!alive(selected)||!selected.tokens.has(eventReadToken)||!reader.hasAction(id,eventReadToken)||result.expiresAt!==selected.expiresAt)throw Error('The selected event view ended.');
  return{...result,readOnly:true};
 }
 function isCurrentToken(id,token){
  const selected=contexts.get(id);
  return Boolean(selected&&alive(selected)&&selected.tokens.has(token)&&reader.hasAction(id,token));
 }
 async function colorRecord(id,actor,token){
  const selected=state(id,actor);
  if(!isCurrentToken(id,token))throw Error('Open the current schedule event.');
  const result=await reader.colorRecord(id,actor,token);
  if(!alive(selected)||!isCurrentToken(id,token)||result.expiresAt!==selected.expiresAt)throw Error('Open the current schedule event.');
  return result;
 }
 return{list,read,clear,colorRecord,isCurrentToken,currentView:(id,viewId)=>Boolean(contexts.get(id)&&alive(contexts.get(id))&&contexts.get(id).viewId===viewId),dispose(){disposed=true;for(const id of contexts.keys())clear(id);reader.dispose();}};
}
