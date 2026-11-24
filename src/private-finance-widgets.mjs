import {escapeHtml as esc} from './core.mjs';
import {savedAccountAmount} from './private-saved-finance-panel.mjs';
import {validDay} from './dev-brief-model.mjs';

const explanation={
 budget:'Current month · percentages use planned income.',
 bills:'Current month · percentages show the share of the expected bill amount paid.',
 investments:'Manual holdings · value on the price date. Gain or loss is a percentage of recorded purchase outlay.'
};
const exact=(value,fields)=>value&&Object.keys(value).sort().join(',')===fields.sort().join(',');
const settings=w=>({showAmounts:w.showAmounts===true,showPercentages:w.showPercentages===true,limit:w.limit??6});
const key=w=>JSON.stringify([w.id,w.type,settings(w)]);
function verify(result,w,now){
 const {showAmounts,showPercentages,limit}=settings(w);
 if(!exact(result,['type','month','total','rows','expiresAt'])||result.type!==w.type||
    !validDay(result.month+'-01')||!Number.isSafeInteger(result.total)||result.total<0||result.total>3100||
    !Array.isArray(result.rows)||result.rows.length!==Math.min(result.total,limit)||
    !Number.isFinite(result.expiresAt)||result.expiresAt<=now||result.expiresAt>now+300000)throw Error();
 for(const r of result.rows){
  if(!exact(r,['label','date',...(showAmounts?['amount']:[]),...(showPercentages?['percentage']:[])])||
     typeof r.label!=='string'||!r.label.trim()||r.label.length>165||
     !(validDay(r.date)||r.date===null&&w.type==='investments')||
     (w.type!=='investments'&&r.date.slice(0,7)!==result.month)||
     (showAmounts&&r.amount!==null&&!Number.isSafeInteger(r.amount))||
     (showPercentages&&r.percentage!==null&&!Number.isFinite(r.percentage)))throw Error();
 }
 return result;
}
export function createFinanceWidgets({client,clock=Date.now,enabled,concealed,onChange}){
 const views=new Map();
 function reset(){for(const v of views.values())clearTimeout(v.timer);views.clear();}
 async function open(w){
  if(!w||!enabled(w.type)||concealed())return;
  const id=key(w),prior=views.get(id);
  if(prior?.busy)return;
  clearTimeout(prior?.timer);
  const view={busy:true};views.set(id,view);onChange();
  try{
   const result=await client.financeWidget(w.type,settings(w));
   if(views.get(id)!==view||concealed())return;
   view.result=verify(result,w,clock());
   view.timer=setTimeout(()=>{if(views.get(id)===view){views.delete(id);onChange();}},result.expiresAt-clock());
   view.timer.unref?.();
  }catch{if(views.get(id)===view)view.failed=true;}
  finally{if(views.get(id)===view){view.busy=false;onChange();}}
 }
 function render(w,blocked=false){
  if(concealed())return '<p>Financial details are hidden.</p>';
  if(!enabled(w.type))return '<p role="status">This financial source is unavailable.</p>';
  const v=views.get(key(w)),r=v?.result;
  const button='<button type="button" class="btn" data-finance-widget-open="'+esc(w.id)+'" '+(v?.busy||blocked?'disabled':'')+'>'+(r?'Refresh saved figures':'Open saved figures')+'</button>';
  if(!r||r.expiresAt<=clock())return (v?.failed?'<p role="status">Could not open the saved figures.</p>':v?.busy?'<p role="status">Opening saved figures…</p>':'')+button;
  let html='<p>'+esc(explanation[w.type])+(w.type==='investments'?'':' '+esc(r.month))+ '</p>';
  if(!r.total)return html+'<p>No saved figures for this view.</p>'+button;
  html+='<ul>'+r.rows.map(row=>'<li>'+esc(row.label)+' · '+(row.date?esc(row.date):'No price date')+
   (w.showAmounts?' · '+(row.amount===null?'Value unavailable':esc(savedAccountAmount(row.amount))):'')+
   (w.showPercentages?' · '+(row.percentage===null?'Percentage unavailable':esc(row.percentage)+'%'):'')+'</li>').join('')+'</ul>';
  if(r.total>r.rows.length)html+='<p>Showing '+r.rows.length+' of '+r.total+'.</p>';
  return html+button;
 }
 return {open,render,reset};
}
