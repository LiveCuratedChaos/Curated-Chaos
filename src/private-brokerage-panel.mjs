import {escapeHtml as e} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
const exact=(v,keys)=>v&&Object.keys(v).sort().join(',')===keys;
const label=v=>typeof v==='string'&&v.length>0&&v.trim()===v&&v.length<=140;
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const numeric=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=Number.MAX_SAFE_INTEGER;
const messages={
 'reconnect-required':'Reconnect the brokerage account before opening holdings.',
 'access-denied':'The brokerage has not granted investment access.',
 'selection-changed':'The authorized accounts changed. Reopen the account choices.',
 'session-ended':'The investment view expired. Reopen the account choices.',
 'source-unavailable':'The brokerage could not be reached. Try opening the accounts again.',
 'incomplete-read':'The brokerage returned an incomplete set of holdings. Reopen the accounts to try again.'
};
const button=(action,title,disabled=false)=>'<button type="button" class="btn" data-brokerage-action="'+action+'" '+(disabled?'disabled':'')+'>'+title+'</button>';
const money=(value,currency,price=false)=>value===null?'Unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency,currencyDisplay:'code',...(price?{maximumFractionDigits:10}:{})}).format(value);
export function createBrokeragePanel({client,clock=Date.now,canOpen=()=>true,onChange=()=>{}}){
 let seq=0,view,offer,link,selected,result,busy,shown,status,timer;
 function reset(){seq++;clearTimeout(timer);view=offer=link=result=null;selected=new Set();busy=shown=false;status='';}reset();
 function validExpiry(v){return Number.isFinite(v)&&v>clock()&&v<=clock()+300000;}
 async function open(){
  reset();const n=seq;busy=true;onChange();
  try{
   const v=await client.brokerageOpen();if(n!==seq)return;
   if(exact(v,'connected,linkInstitution')&&v.connected===false&&label(v.linkInstitution)){offer=v.linkInstitution;return;}
   if(exact(v,'connected')&&v.connected===false){status='No authorized brokerage account is available.';return;}
   if(!exact(v,'accounts,connected,expiresAt,institution')||v.connected!==true||!label(v.institution)||!validExpiry(v.expiresAt)||
    !Array.isArray(v.accounts)||!v.accounts.length||v.accounts.length>10||new Set(v.accounts.map(a=>a.choice)).size!==v.accounts.length||
    v.accounts.some(a=>!exact(a,'choice,name')||!label(a.name)||!token(a.choice)))throw Error();
   view=v;timer=setTimeout(()=>{reset();status=messages['session-ended'];onChange();},v.expiresAt-clock());timer.unref?.();
  }catch(err){if(n===seq)status=messages[err.code]??'Brokerage account choices could not be verified.';}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function read(){
  const n=seq;busy=true;shown=false;result=null;status='';onChange();
  try{
   const v=await client.brokerageRead([...selected]);if(n!==seq)return;
   const names=new Set(view.accounts.filter(a=>selected.has(a.choice)).map(a=>a.name));
   if(!exact(v,'checkedAt,expiresAt,institution,positions')||v.institution!==view.institution||!validExpiry(v.expiresAt)||v.expiresAt!==view.expiresAt||
    typeof v.checkedAt!=='string'||!Number.isFinite(Date.parse(v.checkedAt))||Date.parse(v.checkedAt)>clock()+1000||
    !Array.isArray(v.positions)||v.positions.length>1000)throw Error();
   for(const p of v.positions){
    if(!exact(p,'account,asOf,currency,name,price,quantity,value')||!names.has(p.account)||!label(p.name)||!numeric(p.quantity)||
     p.asOf!==null&&!validDay(p.asOf)||p.currency!==null&&(typeof p.currency!=='string'||!/^[A-Z]{3}$/.test(p.currency))||
     [p.price,p.value].some(x=>x!==null&&(!numeric(x)||!p.currency||!p.asOf)))throw Error();
   }
   result=v;
  }catch(err){if(n===seq){reset();status=messages[err.code]??'The brokerage holdings could not be verified.';onChange();}}
  finally{if(n===seq){busy=false;onChange();}}
 }
 async function authorize(finish){
  const n=seq;busy=true;status='';onChange();
  try{
   const v=await (finish?client.brokerageFinish():client.brokerageBegin());if(n!==seq)return;
   if(finish){
    if(!exact(v,'authorized')||typeof v.authorized!=='boolean')throw Error();
    if(v.authorized){await open();return;}
    status='The brokerage has not completed authorization yet.';
   }else{
    if(!exact(v,'authorizationUrl,expiresAt,institution')||v.institution!==offer||!Number.isFinite(v.expiresAt)||v.expiresAt<=clock()||v.expiresAt>clock()+900000)throw Error();
    const url=new URL(v.authorizationUrl);
    if(url.origin!=='https://secure.plaid.com'||!url.pathname.startsWith('/hl/')||url.username||url.password)throw Error();
    link=v;timer=setTimeout(()=>{reset();status='Authorization expired. Reopen linked investment accounts.';onChange();},Math.max(1,v.expiresAt-clock()));timer.unref?.();
   }
  }catch{if(n===seq){reset();status='Could not verify brokerage authorization. Open your accounts again.';onChange();}}
  finally{if(n===seq){busy=false;onChange();}}
 }
 function render(){
  let html='<h2>Connected investments</h2>'+(status?'<p role="status">'+e(status)+'</p>':'');
  if(busy)html+='<p role="status">Checking the brokerage connection…</p>';
  if(link)return html+'<p>Choose the investment accounts to share at '+e(offer)+'. Then return here to check authorization.</p>'+
   '<a class="btn" target="_blank" rel="noopener noreferrer" href="'+e(link.authorizationUrl)+'">Open brokerage authorization with Plaid</a>'+
   button('finish','Check authorization',busy)+button('close','Close brokerage setup',busy);
  if(offer)return html+'<p>'+e(offer)+' · Choose which investment accounts may share read-only holdings. You can keep using manual investments.</p>'+
   button('begin','Start read-only brokerage authorization',busy)+button('close','Close brokerage setup',busy);
  if(!view)return html+button('open','View linked investment accounts',busy);
  html+='<h3>'+e(view.institution)+'</h3>';
  if(!result){
   html+='<fieldset '+(busy?'disabled':'')+'><legend>Choose accounts for a read-only holdings check</legend>';
   for(const a of view.accounts)html+='<label><input type="checkbox" data-brokerage-account="'+e(a.choice)+'" '+(selected.has(a.choice)?'checked':'')+'>'+e(a.name)+'</label>';
   return html+button('read','Read holdings from selected accounts',busy||!selected.size)+'</fieldset>'+button('close','Close brokerage accounts',busy);
  }
  html+='<p>Brokerage-reported holdings · checked '+e(new Date(result.checkedAt).toLocaleString())+'</p>';
  if(!result.positions.length)html+='<p>No holdings were reported for the selected accounts.</p>';
  else{
   html+=button('amounts',shown?'Hide brokerage amounts':'Show brokerage amounts')+'<ul>';
   for(const p of result.positions)html+='<li><strong>'+e(p.name)+'</strong> · '+e(p.account)+' · Quantity '+e(String(p.quantity))+
    (p.asOf?' · Price as of '+e(p.asOf):' · Price date unavailable')+
    (shown?' · Reported price '+e(money(p.price,p.currency,true))+' · Reported value '+e(money(p.value,p.currency)):'')+'</li>';
   html+='</ul>';
  }
  return html+button('open','Choose investment accounts again')+button('close','Close brokerage accounts');
 }
 return {render,reset,input(event){
  const choice=event.target.dataset?.brokerageAccount;
  if(!choice)return false;
  if(event.type==='input'||!view||result||busy||!view.accounts.some(a=>a.choice===choice))return true;
  if(event.target.checked)selected.add(choice);else selected.delete(choice);onChange();return true;
 },click(event){
  const action=event.target.closest('[data-brokerage-action]')?.dataset?.brokerageAction;
  if(!action)return false;
  if(busy||!canOpen())return true;
  if(action==='open')void open();
  else if(action==='begin'&&offer&&!link)void authorize(false);
  else if(action==='finish'&&link&&link.expiresAt>clock())void authorize(true);
  else if(action==='close'){reset();onChange();void client.brokerageClose().catch(()=>{});}
  else if(action==='read'&&view&&selected.size&&validExpiry(view.expiresAt))void read();
  else if(action==='amounts'&&result&&validExpiry(result.expiresAt)){shown=!shown;onChange();}
  return true;
 }};
}
