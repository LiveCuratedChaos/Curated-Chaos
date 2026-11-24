import {newYorkTaskDay} from './private-smart-task.mjs';
import {escapeHtml as e} from './core.mjs';
import {BRIEF_SNAPSHOT_LIMIT,briefSnapshotLabel,validateBriefSnapshots} from './private-brief-snapshots.mjs';

const token=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const button=(action,label,disabled=false)=>'<button type="button" class="btn" data-brief-snapshot="'+e(action)+'"'+(disabled?' disabled':'')+'>'+e(label)+'</button>';
const same=(a,b)=>a.day===b.day&&a.capturedAt===b.capturedAt&&Object.keys(a.counts).length===Object.keys(b.counts).length&&Object.entries(a.counts).every(([id,n])=>b.counts[id]===n);
const matches=(a,b)=>a.length===b.length&&a.every((entry,i)=>same(entry,b[i]));
export function createBriefSnapshotsPanel({client,clock=Date.now,canUse,onChange}){
 let seq=0,opened=false,busy=false,view=null,review=null,error='',timer;
 function reset(){seq++;clearTimeout(timer);opened=busy=false;view=review=null;error='';}
 const live=n=>n===seq&&opened&&canUse(),fresh=expires=>Number.isFinite(expires)&&expires>clock()&&expires<=clock()+300000;
 function expire(){
  clearTimeout(timer);seq++;busy=false;view=review=null;error='This snapshot view expired. Fetch saved snapshots again.';
 }
 function arm(expires){clearTimeout(timer);timer=setTimeout(()=>{expire();onChange();},Math.max(1,expires-clock()));timer.unref?.();}
 async function read(){
  reset();opened=busy=true;const n=seq;onChange();
  try{
   const result=await client.briefSnapshotsRead();
   if(!live(n))return;
   if(result.readOnly!==false||!token(result.baseTag)||!fresh(result.expiresAt))throw Error();
   view={...result,layout:validateBriefSnapshots(result.layout)};arm(view.expiresAt);
  }catch{if(live(n))error='Saved snapshots could not be checked.';}
  finally{if(live(n)){busy=false;onChange();}}
 }
 async function prepare(removeDay){
  const original=view,n=++seq;busy=true;error='';onChange();
  try{
   const result=await client.briefSnapshotsReview(original.baseTag,removeDay);
   if(!live(n))return;
   const next=validateBriefSnapshots(result.layout).items,previous=original.layout.items;
   const affected=removeDay===undefined?next[0]:previous.find(entry=>entry.day===removeDay);
   if(!affected||!token(result.reviewId)||!fresh(result.expiresAt)||result.expiresAt>original.expiresAt||
    !(removeDay===undefined?matches(next.slice(1),previous):matches(next,previous.filter(entry=>entry!==affected))))throw Error();
   review={...result,items:next,affected,removing:removeDay!==undefined};arm(review.expiresAt);
  }catch{if(live(n)){view=null;error='Capture or removal could not be reviewed. Fetch saved snapshots again.';}}
  finally{if(live(n)){busy=false;onChange();}}
 }
 async function save(){
  const proposed=review,n=++seq;busy=true;review=null;onChange();
  try{
   const reply=await client.briefSnapshotsSave(proposed.reviewId);
   if(!live(n))return;
   if(reply.saved!==true||!matches(validateBriefSnapshots(reply.layout).items,proposed.items))throw Error();
   await read();
  }catch{if(live(n)){view=null;error='The save could not be confirmed. Fetch saved snapshots before trying again.';}}
  finally{if(live(n)){busy=false;onChange();}}
 }
 function entry(item){
  return '<p>Captured '+e(new Date(item.capturedAt).toLocaleString())+'</p><ul>'+
   Object.entries(item.counts).map(([id,count])=>'<li>'+e(briefSnapshotLabel(id))+' · '+count+'</li>').join('')+'</ul>';
 }
 function render(){
  if(!canUse())return '';
  if(!opened)return button('open','Saved Brief snapshots');
  if(view&&!fresh(review?.expiresAt??view.expiresAt))expire();
  const count=view?.layout.items.length??0;
  const todaySaved=view?.layout.items.some(item=>item.day===newYorkTaskDay(clock()));
  return '<section class="panel" aria-label="Saved Brief snapshots"><h2>Saved Brief snapshots</h2>'+
   '<p>Snapshots preserve counts from your selected task, event and note sections when you capture today’s Brief.</p>'+
   (error?'<p role="alert">'+e(error)+'</p>':'')+(busy?'<p role="status">Checking saved snapshots…</p>':'')+
   (review?'<h3>'+e((review.removing?'Remove snapshot for ':'Save snapshot for ')+review.affected.day)+'</h3>'+entry(review.affected)+
    button('approve',review.removing?'Approve snapshot removal':'Approve snapshot save',busy)+button('open','Discard review',busy):
    view?view.layout.items.map(item=>'<details><summary>'+e(item.day)+'</summary>'+entry(item)+button('remove-'+item.day,'Review removal',busy)+'</details>').join('')+
     (todaySaved?'<p>Today’s snapshot is already saved.</p>':count>=BRIEF_SNAPSHOT_LIMIT?'<p>Remove a saved snapshot before capturing another.</p>':button('capture','Review capture of today’s Brief',busy)):
     button('open','Fetch saved snapshots',busy))+
   button('close','Close saved snapshots',busy)+'</section>';
 }
 function click(event){
  const action=event.target.closest?.('[data-brief-snapshot]')?.dataset?.briefSnapshot;
  if(!action)return false;
  if(!canUse()||busy)return true;
  if(action==='open'){void read();return true;}
  if(action==='close'){reset();onChange();void client.briefSnapshotsCancel().catch(()=>{});return true;}
  if(!view||!fresh(review?.expiresAt??view.expiresAt)){expire();onChange();return true;}
  if(action==='approve'&&review)void save();
  if(!review&&action==='capture'&&view.layout.items.length<BRIEF_SNAPSHOT_LIMIT)void prepare();
  if(!review&&action.startsWith('remove-')&&view.layout.items.some(item=>item.day===action.slice(7)))void prepare(action.slice(7));
  return true;
 }
 return {render,click,reset};
}
