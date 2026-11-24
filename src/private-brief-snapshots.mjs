import {validDay} from './dev-brief-model.mjs';

export const BRIEF_SNAPSHOT_LIMIT=12;
const labels={dueTasks:'Open tasks due',upcomingTasks:'Upcoming tasks',undatedTasks:'Undated tasks',
 completedTasks:'Completed tasks',eventsToday:'Events on this date',upcomingEvents:'Upcoming events',notes:'Saved notes'};
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===expected;
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function validateBriefSnapshots(value){
 if(!keys(value,'items,version')||value.version!==1||!Array.isArray(value.items)||value.items.length>BRIEF_SNAPSHOT_LIMIT)throw Error('Saved Brief snapshots are unavailable.');
 const dates=new Set();
 for(const entry of value.items){
  if(!keys(entry,'capturedAt,counts,day')||!validDay(entry.day)||dates.has(entry.day)||!instant(entry.capturedAt)||
   !entry.counts||typeof entry.counts!=='object'||Array.isArray(entry.counts)||!Object.keys(entry.counts).length||
   Object.entries(entry.counts).some(([id,count])=>!Object.hasOwn(labels,id)||!Number.isInteger(count)||count<0||count>2000))throw Error('Saved Brief snapshot is unavailable.');
  dates.add(entry.day);
 }
 return structuredClone(value);
}
export function captureBriefSnapshot(brief,layout){
 const counts=Object.fromEntries(layout.sections.filter(({id,display})=>display==='expanded'&&Object.hasOwn(labels,id)&&Object.hasOwn(brief.counts,id)).map(({id})=>[id,brief.counts[id]]));
 return validateBriefSnapshots({version:1,items:[{day:brief.day,capturedAt:brief.checkedAt,counts}]}).items[0];
}
export const briefSnapshotLabel=id=>labels[id];
