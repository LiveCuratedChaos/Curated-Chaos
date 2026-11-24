const validChoice=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);

export function createWorkTaskListPanel({client,clock,escape,canUse,onChange,onSearch,onExpire}){
 let page=null,loading=false,error='',generation=0,timer;
 const selected=new Set();
 function reset(){generation++;clearTimeout(timer);selected.clear();page=null;loading=false;error='';}
 async function fetchPage(offset=0,refresh=false){
  if(!canUse()||loading)return;
  if(refresh){reset();onExpire();}
  const n=++generation,previous=page?.expiresAt;
  loading=true;error='';onChange();
  try{
   const result=await client.workListOptions({offset,...(previous?{expiresAt:previous}:{})});
   if(n!==generation)return;
   if(!Number.isSafeInteger(result?.expiresAt)||result.expiresAt<=clock()||previous&&previous!==result.expiresAt||result.offset!==offset||!Number.isInteger(result.matchCount)||result.matchCount<0||result.matchCount>2000||offset&&offset>=result.matchCount||!Array.isArray(result.lists)||result.lists.length!==Math.min(50,result.matchCount-offset)||new Set(result.lists.map(row=>row.choice)).size!==result.lists.length||result.lists.some(row=>Object.keys(row).sort().join(',')!=='choice,name'||!validChoice(row.choice)||typeof row.name!=='string'||!row.name.trim()||row.name.length>80))throw Error('Work task lists could not be verified.');
   page=result;clearTimeout(timer);
   timer=setTimeout(()=>{reset();onExpire();onChange();},Math.max(1,result.expiresAt-clock()));
  }catch(err){if(n!==generation)return;reset();error=err.message;onExpire();onChange();return;}
  finally{if(n===generation){loading=false;onChange();}}
 }
 function render(){
  const disabled=loading||!canUse()?'disabled':'';
  const button=(action,label,extra='')=>'<button type="button" class="btn" data-work-list-action="'+action+'" '+disabled+' '+extra+'>'+label+'</button>';
  return '<section class="panel" aria-labelledby="private-work-lists-title"><h2 id="private-work-lists-title">Work task lists</h2>'+
   button('new','Set up a Work list')+' '+button('refresh',page?'Refresh lists':'Choose saved lists')+
   (error?'<p role="alert">'+escape(error)+'</p>':'')+(loading?'<p role="status">Loading lists…</p>':'')+
   (page?(page.lists.length?'<fieldset><legend>Lists to show together</legend>'+page.lists.map(({choice,name})=>'<label><input type="checkbox" data-work-list-choice="'+choice+'" '+(selected.has(choice)?'checked':'')+' '+disabled+'> '+escape(name)+'</label>').join('')+'</fieldset>'+
   (page.offset?button('previous','Previous lists'):'')+(page.offset+50<page.matchCount?button('next','Next lists'):'')+
   '<p>'+selected.size+' selected</p>'+button('show','Show selected tasks',selected.size?'':'disabled'):
   '<p>No saved Work task lists yet. Set up a list, choose your task filters, then use “Name this search” to save it.</p>'):'')+'</section>';
 }
 function input(event){
  const choice=event.target.dataset?.workListChoice;
  if(!choice)return false;
  if(loading||!canUse()||!page?.lists.some(row=>row.choice===choice))return true;
  error='';
  if(!event.target.checked)selected.delete(choice);
  else if(selected.size>=32&&!selected.has(choice))error='Choose up to 32 lists at once.';
  else selected.add(choice);
  onChange('[data-work-list-choice="'+choice+'"]');return true;
 }
 function click(event){
  const action=event.target.closest('[data-work-list-action]')?.dataset.workListAction;
  if(!action)return false;
  if(!canUse()||loading)return true;
  if(action==='new'){reset();onSearch(null);}
  if(action==='refresh')void fetchPage(0,true);
  if(page&&action==='previous'&&page.offset>0)void fetchPage(page.offset-50);
  if(page&&action==='next'&&page.offset+50<page.matchCount)void fetchPage(page.offset+50);
  if(page&&action==='show'&&selected.size&&page.expiresAt>clock())onSearch({choices:[...selected],expiresAt:page.expiresAt});
  return true;
 }
 return{render,reset,input,click};
}
