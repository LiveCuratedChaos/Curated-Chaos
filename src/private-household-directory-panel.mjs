import {escapeHtml as escape} from './core.mjs';

export function createHouseholdDirectoryPanel({client,clock=Date.now,onChange=()=>{}}){
 let listing=null,timer,sequence=0,pending=false,notice='';
 function reset(){
  sequence++;clearTimeout(timer);listing=null;pending=false;notice='';
 }
 function expire(){
  reset();notice='Your household list expired. Open it again.';
 }
 async function open(){
  reset();const request=sequence;pending=true;onChange();
  try{
   const result=await client.householdDirectory();
   if(request!==sequence)return;
   if(!Array.isArray(result?.households)||result.households.length>100||
      !Number.isFinite(result.expiresAt)||result.expiresAt<=clock()||result.expiresAt>clock()+60000||
      result.households.some(row=>typeof row?.name!=='string'||!row.name.trim()||row.name.length>100||
       !['owner','adult'].includes(row.role)))throw Error();
   listing=result;
   timer=setTimeout(()=>{expire();onChange();},Math.max(1,result.expiresAt-clock()));
   timer.unref?.();
  }catch{if(request===sequence)notice='Available households could not be verified.';}
  finally{if(request===sequence){pending=false;onChange();}}
 }
 function render(){
  if(listing&&listing.expiresAt<=clock())expire();
  const heading='<h2>Household Hub</h2><p role="status">'+escape(pending?'Checking households…':notice)+'</p>';
  if(!listing)return heading+'<button type="button" class="btn" data-household-directory="open" '+(pending?'disabled':'')+'>Open households</button>';
  const rows=listing.households.map(row=>'<li>'+escape(row.name)+' · '+(row.role==='owner'?'Owner':'Adult member')+'</li>');
  return heading+(rows.length?'<ul>'+rows.join('')+'</ul>':'<p>No active households.</p>')+
    '<button type="button" class="btn" data-household-directory="close">Close households</button>';
 }
 return {render,reset,click(event){
  const action=event.target.closest('[data-household-directory]')?.dataset.householdDirectory;
  if(action==='open'&&!pending)void open();
  else if(action==='close'){reset();onChange();}
  return action==='open'||action==='close';
 }};
}
