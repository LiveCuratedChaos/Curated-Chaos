import {escapeHtml as esc} from './core.mjs';
import {parseManualAmount} from './private-finance-manual.mjs';
import {savedAccountAmount as dollars} from './private-saved-finance-panel.mjs';
import {newYorkTaskDay} from './private-smart-task.mjs';
import {holdingInputs,holdingActivity,holdingSummary,holdingActivityNames,formatShares,parseShares} from './private-holdings.mjs';

const button=(action,label)=>'<button type="button" class="btn" data-holding-action="'+esc(action)+'">'+esc(label)+'</button>';
const field=(label,name,value,type='text')=>'<label>'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'"></label>';
const decimal=n=>n===null||n===undefined?'':dollars(n).replace(/[$,]/g,'');
const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function activityText(row,shown){
 return esc(row.day)+' · '+holdingActivityNames[row.kind]+(row.shareUnits?' · '+esc(formatShares(row.shareUnits))+' shares':'')+
  (shown?' · '+esc(dollars(row.amountMinor)):'');
}
function summaryText(holding,s,shown){
 const money=n=>shown?esc(dollars(n)):'Hidden';
 const v=s.valuation;
 return '<h3>'+esc(holding.label)+'</h3><p>'+esc(formatShares(s.shareUnits))+' shares recorded</p>'+
  (holding.price?'<p>Owner-entered price · '+esc(holding.price.day)+' · '+money(holding.price.amountMinor)+' per share</p>':'<p>No manual price recorded.</p>')+
  (v?'<dl><dt>Value as of '+esc(v.asOf)+'</dt><dd>'+money(v.marketValueMinor)+'</dd><dt>Gain or loss through '+esc(v.asOf)+'</dt><dd>'+money(v.gainMinor)+'</dd></dl>':'')+
  '<dl><dt>Cash dividends received</dt><dd>'+money(s.cashDividendsMinor)+'</dd><dt>Dividends reinvested</dt><dd>'+money(s.reinvestedDividendsMinor)+'</dd></dl>'+
  (s.estimatedAnnualDividendMinor!==null?'<p>Estimated annual dividends · '+money(s.estimatedAnnualDividendMinor)+' using '+money(holding.annualDividendMinor)+' per share and the recorded share count.</p>':'');
}
export function createHoldingPanel({client,clock=Date.now,canOpen=()=>true,onChange=()=>{}}){
 let view,selection,detail,draft,review,busy,shown,notice,timer,sequence=0;
 function reset(){sequence++;clearTimeout(timer);view=selection=detail=draft=review=null;busy=shown=false;notice='';}reset();
 const fresh=()=>view?.expiresAt>clock();
 async function request(run,accept,message){
  const generation=sequence;busy=true;notice='';onChange();
  try{const result=await run();if(sequence===generation)accept(result);}
  catch{if(sequence===generation)notice=message;}
  finally{if(sequence===generation){busy=false;onChange();}}
 }
 function list(){
  reset();return request(()=>client.manualHoldingList(),v=>{
   if(!keys(v,'expiresAt,holdings')||!Number.isFinite(v.expiresAt)||v.expiresAt<=clock()||v.expiresAt>clock()+300000||
      !Array.isArray(v.holdings)||v.holdings.length>100||new Set(v.holdings.map(h=>h.holdingToken)).size!==v.holdings.length||
      v.holdings.some(h=>!keys(h,'holdingToken,label,version')||!token(h.holdingToken)||typeof h.label!=='string'||h.label.length>100||!Number.isInteger(h.version)||h.version<1))throw Error();
   view=v;timer=setTimeout(()=>{reset();notice='The holding view expired.';onChange();},Math.max(1,v.expiresAt-clock()));timer.unref?.();
  },'Could not open holdings.');
 }
 function read(item){
  selection=item;detail=null;shown=false;
  return request(()=>client.manualHoldingRead({holdingToken:item.holdingToken}),v=>{
   if(!fresh()||!keys(v,'expiresAt,holding,summary,version')||v.expiresAt!==view.expiresAt||v.version!==item.version)throw Error();
   const holding=holdingInputs(v.holding),summary=holdingSummary(holding);
   if(holding.label!==item.label||!equal(v.summary,summary))throw Error();detail={holding,summary};
  },'The holding changed. Open it again.');
 }
 function settings(){
  const h=detail?.holding;
  draft={type:'settings',label:h?.label??'',price:decimal(h?.price?.amountMinor),date:h?.price?.day??'',annual:decimal(h?.annualDividendMinor)};
 }
 function activity(index){
  const row=index===null?null:detail.holding.activities[index];
  if(index!==null&&!row)return;
  draft={type:'activity',index,kind:row?.kind??'buy',day:row?.day??newYorkTaskDay(clock()),amount:decimal(row?.amountMinor),shares:row?.shareUnits?formatShares(row.shareUnits):''};
 }
 async function prepare(){
  let expected,body;
  try{
   if(draft.type==='settings'){
    if(Boolean(draft.price)!==Boolean(draft.date))throw Error();
    const settings={label:draft.label.trim(),price:draft.price?{day:draft.date,amountMinor:parseManualAmount(draft.price)}:null,
     annualDividendMinor:draft.annual?parseManualAmount(draft.annual):null};
    expected=holdingInputs({...settings,activities:detail?.holding.activities??[]});
    body={settings,...(selection?{holdingToken:selection.holdingToken}:{})};
   }else{
    const a=holdingActivity({kind:draft.kind,day:draft.day,amountMinor:parseManualAmount(draft.amount),shareUnits:draft.kind==='dividend'?0:parseShares(draft.shares)});
    const activities=[...detail.holding.activities];activities[draft.index??activities.length]=a;
    expected=holdingInputs({...detail.holding,activities});body={holdingToken:selection.holdingToken,index:draft.index,activity:a};
   }
   holdingSummary(expected);
  }catch{notice='Check the amount, shares, dates and share balance. A manual price needs its as-of date.';onChange();return;}
  await request(()=>client.manualHoldingReview(body),v=>{
   if(keys(v,'noChanges')&&v.noChanges===true){notice='No changes to save.';return;}
   if(!fresh()||!keys(v,'expiresAt,holding,reviewId,summary')||!token(v.reviewId)||v.expiresAt!==view.expiresAt||
      !equal(holdingInputs(v.holding),expected)||!equal(holdingSummary(expected),v.summary))throw Error();
   review=v;
  },'Could not verify this holding change. Check the dates or reopen the holding.');
 }
 async function save(){
  const generation=sequence;busy=true;onChange();
  try{const v=await client.manualHoldingSave(review.reviewId);if(generation!==sequence)return;
   if(v?.saved!==true||!Number.isInteger(v.version)||v.version!==(selection?.version??0)+1)throw Error();await list();}
  catch{if(sequence===generation){reset();notice='Save could not be confirmed. Reopen the holding before retrying.';onChange();}}
 }
 function render(){
  const heading='<h2>Manual investments</h2><p role="status">'+esc(busy?'Checking holdings…':notice)+'</p>';
  let body;
  if(!fresh())body=button('load','Open manual holdings');
  else if(review){
   const changed=draft.type==='activity'?review.holding.activities[draft.index??review.holding.activities.length-1]:null;
   body='<legend>Review '+(changed?'recorded activity':'holding settings')+'</legend>'+
    (changed?'<p>'+activityText(changed,true)+'</p>':'')+summaryText(review.holding,review.summary,true)+button('approve','Approve holding save')+button('back','Back to edit');
  }else if(draft){
   const fields=draft.type==='settings'?field('Holding name','label',draft.label)+field('Manual price per share (optional)','price',draft.price)+
    field('Price as of','date',draft.date,'date')+field('Estimated annual dividend per share (optional)','annual',draft.annual):
    '<label>Recorded activity<select name="kind">'+Object.entries(holdingActivityNames).map(([k,n])=>'<option value="'+k+'" '+(k===draft.kind?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
    field('Activity date','day',draft.day,'date')+field('Total dollar amount','amount',draft.amount)+(draft.kind==='dividend'?'':field('Shares','shares',draft.shares));
   body='<form id="holding-edit">'+fields+'<button>Review change</button>'+button('discard','Cancel edit')+'</form>';
  }else if(detail){
   body=summaryText(detail.holding,detail.summary,shown)+button('amounts',shown?'Hide amounts':'Show amounts')+button('settings','Edit holding')+button('activity','Record activity');
   const ordered=detail.holding.activities.map((row,index)=>({row,index})).sort((a,b)=>b.row.day.localeCompare(a.row.day)||b.index-a.index);
   if(ordered.length)body+='<h3>Activity history</h3>'+ordered.map(({row,index})=>'<p>'+activityText(row,shown)+' '+button('correct-'+index,'Correct activity')+'</p>').join('');
   body+=button('list','Back to holdings');
  }else body=view.holdings.map(h=>button('select-'+h.holdingToken,h.label)).join('')+button('add','Add holding')+button('close','Close holdings');
  return heading+'<fieldset '+(busy?'disabled':'')+'>'+body+'</fieldset>';
 }
 return {render,reset,blocked:()=>Boolean(draft||review||busy),input(event){
  const el=event.target;if(el.form?.id!=='holding-edit')return false;
  if(draft&&!busy&&!review&&Object.hasOwn(draft,el.name)&&!['index','type'].includes(el.name)){draft[el.name]=el.value;if(el.name==='kind')onChange();}
  return true;
 },submit(event){
  if(event.target.id!=='holding-edit')return false;event.preventDefault();if(fresh()&&draft&&!review&&!busy)void prepare();return true;
 },click(event){
  const action=event.target.closest('[data-holding-action]')?.dataset.holdingAction;
  if(!action)return false;if(busy)return true;
  if(action==='load'){if(canOpen())void list();return true;}if(!fresh())return true;
  if(review){if(action==='approve')void save();if(action==='back'){review=null;onChange();}return true;}
  if(draft){if(action==='discard'){draft=null;notice='';onChange();}return true;}
  if(!canOpen())return true;
  if(action==='close'){reset();void client.manualHoldingCancel().catch(()=>{});}
  if(action==='list'){void list();return true;}
  if(action.startsWith('select-')){const h=view.holdings.find(item=>item.holdingToken===action.slice(7));if(h){void read(h);return true;}}
  if(action==='add'&&!selection||action==='settings'&&detail)settings();
  if(action==='activity'&&detail)activity(null);if(/^correct-\d+$/.test(action)&&detail)activity(Number(action.slice(8)));
  if(action==='amounts'&&detail)shown=!shown;
  onChange();return true;
 }};
}
