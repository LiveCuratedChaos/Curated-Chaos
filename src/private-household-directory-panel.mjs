import {escapeHtml as escape} from './core.mjs';

export function createHouseholdDirectoryPanel({client,clock=Date.now,onChange=()=>{}}){
 let selected=null,listing=null,timer,sequence=0,pending=false,notice='';
 function reset(){
  sequence++;clearTimeout(timer);listing=selected=null;pending=false;notice='';
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
 async function choose(choice){
  const row=listing?.households.find(household=>household.choice===choice);
  if(!row||pending)return;
  const request=++sequence;pending=true;selected=null;notice='';onChange();
  try{
   const result=await client.householdSummary(choice);
   if(request!==sequence)return;
   if(!listing||listing.expiresAt<=clock()){expire();onChange();return;}
   if(![result?.tasks,result?.notes].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error();
   selected={name:row.name,tasks:result.tasks,notes:result.notes};
  }catch{if(request===sequence){reset();notice='This household summary could not be verified. Open households again.';onChange();}}
  finally{if(request===sequence){pending=false;onChange();}}
 }
 function render(){
  if(listing&&listing.expiresAt<=clock())expire();
  const heading='<h2>Household Hub</h2><p role="status">'+escape(pending?'Checking households…':notice)+'</p>';
  if(!listing)return heading+'<button type="button" class="btn" data-household-directory="open" '+(pending?'disabled':'')+'>Open households</button>';
  const rows=listing.households.map(row=>'<li>'+escape(row.name)+' · '+(row.role==='owner'?'Owner':'Adult member')+
   (typeof row.choice==='string'&&/^[A-Za-z0-9_-]{43}$/.test(row.choice)?' <button class="btn" type="button" data-household-directory="select-'+row.choice+'" '+(pending?'disabled':'')+'>View summary</button>':'')+'</li>');
  const summary=selected?'<h3>'+escape(selected.name)+'</h3><p>Visible shared tasks: '+selected.tasks+' · Visible shared notes: '+selected.notes+'</p>':'';
  return heading+(rows.length?'<ul>'+rows.join('')+'</ul>':'<p>No active households.</p>')+summary+
    '<button type="button" class="btn" data-household-directory="close">Close households</button>';
 }
 return {render,reset,click(event){
  const action=event.target.closest('[data-household-directory]')?.dataset.householdDirectory;
  if(action==='open'&&!pending)void open();
  else if(action==='close'){reset();onChange();}
  else if(action?.startsWith('select-')){
   if(listing&&listing.expiresAt>clock())void choose(action.slice(7));
   else{expire();onChange();}
   return true;
  }
  return action==='open'||action==='close';
 }};
}
