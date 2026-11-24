import {verifyReceiptPicker,renderReceiptPicker} from './private-receipt-picker.mjs';
import {downloadCheckedDocument} from './private-document-panel.mjs';
import {escapeHtml as esc} from './core.mjs';
import {validDay} from './dev-brief-model.mjs';
import {parseManualAmount,manualBudgetPeriod} from './private-finance-manual.mjs';
import {transactionCategories} from './private-transaction-categories.mjs';
import {savedAccountAmount as dollars} from './private-saved-finance-panel.mjs';

const keys=(v,fields)=>v&&Object.keys(v).sort().join(',')===fields;
const token=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v);
const decimal=n=>dollars(n).replace(/[$,]/g,'');
const button=(action,label)=>'<button type="button" class="btn" data-tx-category="'+esc(action)+'">'+esc(label)+'</button>';
const field=(label,name,value)=>'<label>'+esc(label)+'<input name="'+name+'" value="'+esc(value)+'"></label>';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function categoryText(c,shown){
 if(!c)return '<p>Uncategorized</p>';
 const allocation=c.splits?c.splits.map(s=>esc(s.category)+(shown?' · '+esc(dollars(s.amountMinor)):'')).join('<br>'):esc(c.category);
 return '<p>'+allocation+'</p>'+(c.receiptReference?'<p>Receipt reference · '+esc(c.receiptReference)+'</p>':'');
}
function verifyMatch(m){
 if(!keys(m,'differenceMinor,expense,period,postedDay,postedMinor')||!keys(m.period,'period,periodEnd,periodStart')||
    !keys(m.expense,'amountMinor,day,label')||typeof m.expense.label!=='string'||m.expense.label.length>140||!validDay(m.expense.day)||
    !validDay(m.postedDay)||!Number.isSafeInteger(m.postedMinor)||m.postedMinor<=0||!Number.isSafeInteger(m.expense.amountMinor)||m.expense.amountMinor<0||
    m.expense.day<m.period.periodStart||m.expense.day>m.period.periodEnd||m.differenceMinor!==m.postedMinor-m.expense.amountMinor)throw Error('Invalid expense match.');
 manualBudgetPeriod(m.period);return m;
}
function matchText(m,show){
 const money=n=>show?esc(dollars(n)):'Hidden';
 return '<p>Posted debit · '+esc(m.postedDay)+' · '+money(m.postedMinor)+'</p><p>Manual expense · '+esc(m.expense.day)+' · '+money(m.expense.amountMinor)+
  (m.expense.label?' · '+esc(m.expense.label):'')+'</p><p>Posted minus recorded · '+money(m.differenceMinor)+'</p><p>Budget period · '+esc(m.period.periodStart)+' through '+esc(m.period.periodEnd)+'</p>';
}
function monthPeriod(day){
 if(!validDay(day))throw Error('Choose a budget date.');
 const last=new Date(day+'T00:00:00Z');last.setUTCMonth(last.getUTCMonth()+1,0);
 return {period:'month',periodStart:day.slice(0,8)+'01',periodEnd:last.toISOString().slice(0,10)};
}
export function createTransactionCategoryPanel({client,clock=Date.now,allowExpenseMatching=false,allowDocuments=false,canDownload=()=>true,download,canOpen=()=>true,onChange=()=>{}}){
 let view,selected,detail,draft,review,matching,receipt,notice,shown,busy,timer,sequence=0;
 function reset(){sequence++;clearTimeout(timer);view=selected=detail=draft=review=matching=receipt=null;notice='';shown=busy=false;}
 reset();
 const fresh=()=>view?.expiresAt>clock();
 async function request(run,accept,message){
  const generation=sequence;busy=true;notice='';onChange();
  try{const result=await run();if(generation===sequence)accept(result);}
  catch{if(generation===sequence)notice=message;}
  finally{if(generation===sequence){busy=false;onChange();}}
 }
 function page(offset){
  reset();
  return request(()=>client.transactionCategoryOpen(offset),v=>{
   if(!keys(v,'expiresAt,items,more,offset')||v.offset!==offset||!Number.isFinite(v.expiresAt)||v.expiresAt<=clock()||v.expiresAt>clock()+300000||
      typeof v.more!=='boolean'||!Array.isArray(v.items)||v.items.length>20||new Set(v.items.map(i=>i.transactionToken)).size!==v.items.length||
      v.items.some(i=>!keys(i,'day,label,pending,transactionToken')||!token(i.transactionToken)||typeof i.label!=='string'||i.label.length>300||
       !validDay(i.day)||typeof i.pending!=='boolean'))throw Error();
   view=v;timer=setTimeout(()=>{reset();notice='Your transaction view expired.';onChange();},Math.max(1,v.expiresAt-clock()));timer.unref?.();
  },'Could not open saved transactions.');
 }
 function read(item){
  detail=null;selected=item;shown=false;
  return request(()=>client.transactionCategoryRead(item.transactionToken),v=>{
   if(!fresh()||!keys(v,allowExpenseMatching?'amountMinor,categories,day,expiresAt,label,match,pending,previous':'amountMinor,categories,day,expiresAt,label,pending,previous')||v.expiresAt!==view.expiresAt||v.label!==item.label||
      v.day!==item.day||v.pending!==item.pending||!Number.isSafeInteger(v.amountMinor)||
      v.previous!==null&&(!keys(v.previous,'amountMinor,day')||!validDay(v.previous.day)||!Number.isSafeInteger(v.previous.amountMinor)))throw Error();
   if(allowExpenseMatching&&v.match!==null)verifyMatch(v.match);
   if(v.categories!==null)transactionCategories(v.categories,v.previous??v);
   detail=v;
  },'The selected transaction changed. Open the list again.');
 }
 function edit(){
  const c=detail.categories;
  draft={category:c?.category??'',receiptReference:c?.receiptReference??'',splits:(c?.splits??[]).map(s=>({category:s.category,amount:decimal(s.amountMinor)}))};
 }
 function expensePage(offset){
  let period;
  try{period=matching.period.period==='month'?monthPeriod(matching.period.periodStart):manualBudgetPeriod(matching.period);}
  catch{notice='Choose a valid budget period.';onChange();return;}
  matching.page=null;
  return request(()=>client.transactionExpenseCandidates({transactionToken:selected.transactionToken,period,offset}),v=>{
   if(!fresh()||!keys(v,'expiresAt,items,more,offset,period')||v.expiresAt!==view.expiresAt||!same(v.period,period)||v.offset!==offset||
      typeof v.more!=='boolean'||!Array.isArray(v.items)||v.items.length>20||new Set(v.items.map(i=>i.expenseToken)).size!==v.items.length||
      v.items.some(i=>!keys(i,'amountMinor,category,day,expenseToken,label')||!token(i.expenseToken)||!validDay(i.day)||i.day<period.periodStart||i.day>period.periodEnd||
       typeof i.label!=='string'||i.label.length>140||typeof i.category!=='string'||i.category.length>1640||!Number.isSafeInteger(i.amountMinor)||i.amountMinor<0))throw Error();
   matching.period=period;matching.page=v;
  },'Could not verify the expenses for this budget period.');
 }
 function prepareMatch(expense){
  return request(()=>client.transactionCategoryReview({transactionToken:selected.transactionToken,expenseToken:expense.expenseToken}),v=>{
   if(!fresh()||!keys(v,'expiresAt,label,match,reviewId')||v.expiresAt!==view.expiresAt||v.label!==detail.label||!token(v.reviewId))throw Error();
   const m=verifyMatch(v.match);
   if(m.postedDay!==detail.day||m.postedMinor!==detail.amountMinor||m.expense.day!==expense.day||m.expense.label!==expense.label||
      m.expense.amountMinor!==expense.amountMinor||!same(m.period,matching.period))throw Error();
   review=v;
  },'The expense or posted transaction changed. Reopen it before reviewing again.');
 }
 async function prepare(){
  let categories;
  try{categories=transactionCategories({category:draft.splits.length?'':draft.category.trim(),receiptReference:draft.receiptReference.trim(),
   ...(draft.splits.length?{splits:draft.splits.map(s=>({category:s.category.trim(),amountMinor:parseManualAmount(s.amount)}))}:{})},detail);}
  catch{notice='Enter a category or split the exact transaction total between distinct categories.';onChange();return;}
  await request(()=>client.transactionCategoryReview({transactionToken:selected.transactionToken,categories}),v=>{
   if(keys(v,'noChanges')&&v.noChanges===true){notice='These categories are already saved.';return;}
   if(!fresh()||!keys(v,'amountMinor,categories,day,expiresAt,label,reviewId')||!token(v.reviewId)||v.expiresAt!==view.expiresAt||
      v.label!==detail.label||v.day!==detail.day||v.amountMinor!==detail.amountMinor||!same(transactionCategories(v.categories,v),categories))throw Error();
   review=v;
  },'Could not verify the selected transaction and categories.');
 }
 async function save(){
  const generation=sequence;busy=true;onChange();
  try{const result=await client.transactionCategorySave(review.reviewId);if(sequence!==generation)return;
   if(result?.saved!==true||!Number.isInteger(result.version)||result.version<1)throw Error();await page(view.offset);}
  catch{if(sequence===generation){reset();notice='Save could not be confirmed. Reopen the transaction before retrying.';onChange();}}
 }
 function receiptAction(action,choice=null){
  const transactionToken=selected.transactionToken;
  if(action==='download')return request(()=>client.savedTransactionReceiptDownload(transactionToken),v=>{
   if(!fresh()||v?.fields?.name!==receipt?.attachedName)throw Error();
   if(canDownload())downloadCheckedDocument(v,null,download);
  },'Could not verify the attached receipt. Reopen the transaction.');
  if(action==='choose'){
   const name=choice===null?null:receipt.files.find(f=>f.choice===choice)?.name;
   if(name===undefined)return;
   return request(()=>client.transactionCategoryReview({transactionToken,receiptChoice:choice}),v=>{
    if(v?.noChanges===true){notice='This file is already attached.';return;}
    if(!fresh()||!keys(v,'amountMinor,categories,day,expiresAt,label,receiptName,reviewId')||!token(v.reviewId)||
     v.expiresAt!==view.expiresAt||v.label!==detail.label||v.day!==detail.day||v.amountMinor!==detail.amountMinor||
     !same(v.categories,detail.categories)||v.receiptName!==name)throw Error();
    review=v;
   },'Could not verify this receipt change. Reopen the source transaction.');
  }
  const offset=action==='next'?receipt.offset+25:action==='prev'?receipt.offset-25:0;
  return request(()=>client.savedTransactionReceipts(transactionToken,offset),v=>{
   if(!fresh())throw Error();receipt=verifyReceiptPicker(v,offset,view.expiresAt);
  },'Could not open your receipt files.');
 }
 function render(){
  const heading='<h2>Saved transaction categories</h2><p role="status">'+esc(busy?'Checking transactions…':notice)+'</p>';
  let body;
  if(!fresh())body=button('load','Categorize saved transactions');
  else if(review&&Object.hasOwn(review,'receiptName'))body='<legend>Review receipt link</legend><p>'+esc(detail.label)+' · '+esc(detail.day)+'</p><p>'+
   (review.receiptName?'Link library file · '+esc(review.receiptName):'Remove this receipt link and keep the library file.')+'</p>'+
   button('approve','Approve receipt link change')+button('back','Back to receipt files');
  else if(receipt)body=renderReceiptPicker(receipt,button);
  else if(review?.match)body='<legend>Review expense match</legend><p>'+esc(detail.label)+'</p>'+matchText(review.match,true)+
   '<p>Linking keeps the recorded amount and adds no expense.</p>'+button('approve','Approve expense match')+button('back','Back to expenses');
  else if(review)body='<legend>Review transaction categories</legend><p>'+esc(review.label)+' · '+esc(review.day)+' · '+esc(dollars(Math.abs(review.amountMinor)))+' · '+
   (review.amountMinor<0?'Inflow':review.amountMinor>0?'Outflow':'Zero amount')+'</p>'+categoryText(review.categories,true)+button('approve','Approve categories')+button('back','Back to edit');
  else if(matching){
   const p=matching.period,pg=matching.page;
   body='<legend>Match to a manual expense</legend><p>'+esc(detail.label)+' · '+esc(detail.day)+' · '+esc(dollars(detail.amountMinor))+'</p>'+
    '<form id="expense-match-period"><label>Budget period<select name="period"><option value="month">Monthly</option><option value="pay_period" '+(p.period==='pay_period'?'selected':'')+'>Pay period</option></select></label>'+
    '<label>Start date<input type="date" name="periodStart" value="'+esc(p.periodStart)+'"></label>'+
    (p.period==='pay_period'?'<label>End date<input type="date" name="periodEnd" value="'+esc(p.periodEnd)+'"></label>':'')+'<button>Find expenses</button></form>';
   if(pg){
    body+=pg.items.map((e,i)=>'<p>'+esc(e.label||e.category)+' · '+esc(e.day)+' · '+esc(dollars(e.amountMinor))+' '+button('expense-'+i,'Review this match')+'</p>').join('')||'<p>No unmatched expenses on this page.</p>';
    if(pg.offset)body+=button('earlier-expenses','Previous expenses');
    if(pg.more)body+=button('later-expenses','Next expenses');
   }
   body+=button('discard-match','Back to saved transaction');
  }
  else if(draft){
   let fields;
   if(draft.splits.length)fields=draft.splits.map((s,i)=>'<fieldset><legend>Split '+(i+1)+'</legend>'+field('Category','category-'+i,s.category)+field('Amount','amount-'+i,s.amount)+
    (draft.splits.length>2?button('remove-'+i,'Remove split'):'')+'</fieldset>').join('')+(draft.splits.length<20?button('add','Add split'):'')+button('single','Use one category');
   else fields=field('Category','category',draft.category)+(Math.abs(detail.amountMinor)>=2?button('split','Split transaction'):'');
   body='<form id="saved-category-edit"><p>'+esc(detail.label)+' · '+esc(dollars(Math.abs(detail.amountMinor)))+'</p>'+fields+field('Receipt reference (optional)','receiptReference',draft.receiptReference)+
    '<button>Review categories</button>'+button('discard','Cancel edit')+'</form>';
  }else if(detail)body='<legend>'+esc(detail.label)+'</legend><p>'+esc(detail.day)+' · '+(detail.amountMinor<0?'Inflow':detail.amountMinor>0?'Outflow':'Zero amount')+
   (shown?' · '+esc(dollars(Math.abs(detail.amountMinor))):'')+'</p>'+(detail.previous?'<p>The saved source changed since these categories were reviewed.</p>':'')+
   categoryText(detail.categories,shown)+(detail.match?'<h3>Matched manual expense</h3>'+matchText(detail.match,shown):allowExpenseMatching&&!detail.pending&&detail.amountMinor>0?button('start-match','Match to manual expense'):'')+button('amounts',shown?'Hide amounts':'Show amounts')+(detail.pending?'<p>Pending transaction</p>':button('edit','Edit categories'))+(allowDocuments&&!detail.pending?button('receipts','Receipt file'):'')+button('list','Back to transactions');
  else body=(view.items.map(i=>button('select-'+i.transactionToken,i.label+' · '+i.day+(i.pending?' · Pending':''))).join('')||'<p>No saved transactions on this page.</p>')+
   (view.offset?button('previous','Previous page'):'')+(view.more?button('next','Next page'):'')+button('close','Close transactions');
  return heading+'<fieldset '+(busy?'disabled':'')+'>'+body+'</fieldset>';
 }
 return {render,reset,blocked:()=>Boolean(draft||review||matching||busy),input(event){
  const el=event.target;
  if(el.form?.id==='expense-match-period'){
   if(matching&&!review&&!busy&&Object.hasOwn(matching.period,el.name)){matching.period[el.name]=el.value;const redraw=Boolean(matching.page)||el.name==='period';matching.page=null;if(redraw)onChange();}
   return true;
  }
  if(el.form?.id!=='saved-category-edit')return false;
  if(draft&&!review&&!busy){
   if(['category','receiptReference'].includes(el.name))draft[el.name]=el.value;
   const match=/^(category|amount)-(\d+)$/.exec(el.name);if(match&&draft.splits[Number(match[2])])draft.splits[Number(match[2])][match[1]]=el.value;
  }
  return true;
 },submit(event){
  if(event.target.id==='expense-match-period'){event.preventDefault();if(fresh()&&!busy&&!review&&matching)void expensePage(0);return true;}
  if(event.target.id!=='saved-category-edit')return false;event.preventDefault();if(fresh()&&draft&&!busy&&!review)void prepare();return true;
 },click(event){
  const action=event.target.closest('[data-tx-category]')?.dataset.txCategory;
  if(!action)return false;if(busy)return true;
  if(action==='load'){if(canOpen())void page(0);return true;}
  if(!fresh())return true;
  if(review){if(action==='approve')void save();if(action==='back'){review=null;onChange();}return true;}
  if(allowDocuments&&detail&&!detail.pending&&!draft&&!matching){
   if(action==='receipts'){void receiptAction('open');return true;}
   if(receipt){
    if(action==='receipt-close'){receipt=null;onChange();}
    else if(action==='receipt-next'||action==='receipt-prev')void receiptAction(action.slice(8));
    else if(action==='receipt-download'&&receipt.attachedName)void receiptAction('download');
    else if(action==='receipt-unlink'&&receipt.attachedName)void receiptAction('choose');
    else if(action.startsWith('receipt-choose-'))void receiptAction('choose',action.slice('receipt-choose-'.length));
    return true;
   }
  }
  if(matching){
   if(action==='discard-match'){matching=null;notice='';onChange();}
   else if(action==='earlier-expenses'&&matching.page?.offset)void expensePage(matching.page.offset-20);
   else if(action==='later-expenses'&&matching.page?.more)void expensePage(matching.page.offset+20);
   else if(/^expense-\d+$/.test(action)){const expense=matching.page?.items[Number(action.slice(8))];if(expense)void prepareMatch(expense);}
   return true;
  }
  if(draft){
   if(action==='discard')draft=null;
   else if(action==='split'&&!draft.splits.length)draft.splits=[{category:draft.category,amount:decimal(Math.abs(detail.amountMinor))},{category:'',amount:''}];
   else if(action==='add'&&draft.splits.length>=2&&draft.splits.length<20)draft.splits.push({category:'',amount:''});
   else if(action==='single'){draft.category=draft.splits[0]?.category??draft.category;draft.splits=[];}
   else if(/^remove-\d+$/.test(action)&&draft.splits.length>2)draft.splits.splice(Number(action.slice(7)),1);
   onChange();return true;
  }
  if(!canOpen())return true;
  if(action==='close'){reset();void client.transactionCategoryCancel().catch(()=>{});}
  if(action==='previous'&&view.offset){void page(view.offset-20);return true;}if(action==='next'&&view.more){void page(view.offset+20);return true;}
  if(action==='list'){void page(view.offset);return true;}
  if(action.startsWith('select-')){const item=view.items.find(i=>i.transactionToken===action.slice(7));if(item){void read(item);return true;}}
  if(detail&&allowExpenseMatching&&action==='start-match'&&!detail.match&&!detail.pending&&detail.amountMinor>0){
   matching={period:monthPeriod(detail.day),page:null};void expensePage(0);return true;
  }
  if(detail&&action==='amounts')shown=!shown;if(detail&&!detail.pending&&action==='edit')edit();
  onChange();return true;
 }};
}
