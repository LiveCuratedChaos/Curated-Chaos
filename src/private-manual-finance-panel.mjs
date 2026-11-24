import {escapeHtml as escape} from './core.mjs';
import {MANUAL_ACCOUNT_TYPES, includedManualBalance, normalizeManualFinanceAccount,parseManualAmount} from './private-finance-manual.mjs';
import {savedAccountAmount} from './private-saved-finance-panel.mjs';

const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const typeNames = {checking:'Checking',savings:'Savings',cash:'Cash',credit_card:'Credit card',loan:'Loan',investment:'Investment',other:'Other'};
const button = (action,label,disabled=false) => '<button type="button" class="btn" data-manual-account="'+escape(action)+'" '+(disabled?'disabled':'')+'>'+escape(label)+'</button>';

function readList(result, now) {
 if (!result || Object.keys(result).sort().join(',')!=='accounts,expiresAt,limit' ||
     !Number.isFinite(result.expiresAt) || result.expiresAt<=now || result.expiresAt>now+300000 ||
     result.limit!==100 || !Array.isArray(result.accounts) || result.accounts.length>100) throw Error();
 const seen=new Set();
 for(const row of result.accounts) {
  if (!row || Object.keys(row).sort().join(',')!=='account,accountToken,version' ||
      !validToken(row.accountToken) || seen.has(row.accountToken) || !Number.isSafeInteger(row.version) || row.version<1) throw Error();
  seen.add(row.accountToken);
  normalizeManualFinanceAccount(row.account);
 }
 includedManualBalance(result.accounts.map(row=>row.account));
 return result;
}
export function createManualFinancePanel({client,clock=Date.now,onChange=()=>{},canOpen=()=>true}) {
 let view=null,draft=null,review=null,busy=false,shown=false,manage=false,notice='',timer,sequence=0;
 function reset() {
  sequence++;clearTimeout(timer);view=null;draft=null;review=null;shown=false;manage=false;busy=false;notice='';
 }
 function fresh(){return view && view.expiresAt>clock();}
 function redraw(){onChange();}
 function arm(){
  clearTimeout(timer);
  timer=setTimeout(()=>{reset();notice='Your account view expired. Open it again to continue.';redraw();},Math.max(1,view.expiresAt-clock()));
  timer.unref?.();
 }
 async function load(){
  reset(); const run=sequence;busy=true;redraw();
  try {
   const result=await client.manualAccountsList();
   if(run!==sequence)return;
   view=readList(result,clock());arm();
  } catch {if(run===sequence)notice='Manual accounts could not be opened. Try again.';}
  finally {if(run===sequence){busy=false;redraw();}}
 }
 function edit(token){
  const row=token&&view.accounts.find(r=>r.accountToken===token);
  if(token&&!row)return;
  const a=row?.account;
  draft={token,label:a?.label??'',type:a?.type??'checking',balance:a?savedAccountAmount(a.balanceMinor).replace(/[$,]/g,''):'',
   showInAccountList:a?.showInAccountList??true,includeInBudget:a?.includeInBudget??true};
  review=null;notice='';redraw();
 }
 async function prepare(){
  const run=++sequence;busy=true;notice='';redraw();
  try {
   const {label,type,showInAccountList,includeInBudget}=draft;
   const account=normalizeManualFinanceAccount({label:label.trim(),type,balanceMinor:parseManualAmount(draft.balance),showInAccountList,includeInBudget});
   const result=await client.manualAccountsReview({account,...(draft.token?{accountToken:draft.token}:{})});
   if(run!==sequence||!fresh())return;
   if(result?.noChanges===true){notice='No account settings changed.';return;}
   if(!result||Object.keys(result).sort().join(',')!=='account,action,expiresAt,reviewId'||
      !validToken(result.reviewId)||result.action!==(draft.token?'edit':'create')||
      result.expiresAt!==view.expiresAt||JSON.stringify(normalizeManualFinanceAccount(result.account))!==JSON.stringify(account))throw Error();
   review=result;
  } catch {if(run===sequence)notice='Check the account name and dollar amount, then review again.';}
  finally {if(run===sequence){busy=false;redraw();}}
 }
 async function save(){
  if(!review || !fresh())return;
  const run=++sequence;busy=true;redraw();
  try {
   const result=await client.manualAccountsSave(review.reviewId);
   if(run!==sequence)return;
   if(result?.saved!==true || JSON.stringify(normalizeManualFinanceAccount(result.account))!==JSON.stringify(review.account))throw Error();
   await load();
  } catch {
   if(run!==sequence)return;
   reset();notice='Save could not be confirmed. Open manual accounts to check before retrying.';redraw();
  }
 }
 function render(){
  const status='<p role="status">'+escape(busy?'Checking manual accounts…':notice)+'</p>';
  let html='<h2>Manual accounts</h2>';
  if(!fresh())return html+button('load','Open manual accounts',busy)+status;
  html+=status;
  if(review){
   const a=review.account;
   return html+'<h3>Review account</h3><p>'+escape(a.label)+' · '+typeNames[a.type]+' · '+escape(savedAccountAmount(a.balanceMinor))+'</p><p>'+
    (a.showInAccountList?'Shown in accounts.':'Hidden from accounts.')+' '+(a.includeInBudget?'Included in total.':'Excluded from total.')+'</p>'+
    button('save','Approve account save',busy)+button('back','Back to edit',busy);
  }
  if(draft)return html+'<form id="manual-account-edit"><fieldset '+(busy?'disabled':'')+'><legend>'+ (draft.token?'Edit account':'Add account')+
   '</legend><label>Account name<input name="label" required maxlength="100" value="'+escape(draft.label)+'"></label>'+
   '<label>Account type<select name="type">'+MANUAL_ACCOUNT_TYPES.map(type=>'<option value="'+type+'" '+(draft.type===type?'selected':'')+'>'+typeNames[type]+'</option>').join('')+'</select></label>'+
   '<label>Balance (USD)<input required inputmode="decimal" name="balance" value="'+escape(draft.balance)+'"></label><small>Enter debt as a negative balance.</small>'+
   '<label><input type="checkbox" name="showInAccountList" '+(draft.showInAccountList?'checked':'')+'> Show in account list</label>'+
   '<label><input type="checkbox" name="includeInBudget" '+(draft.includeInBudget?'checked':'')+'> Include in total balance</label>'+
   '<button class="btn" type="submit">Review account</button>'+button('cancel','Cancel')+'</fieldset></form>';
  const rows=view.accounts.filter(row=>manage||row.account.showInAccountList);
  html+='<p>Total balance: '+(shown?escape(savedAccountAmount(includedManualBalance(view.accounts.map(r=>r.account)))):'Hidden')+'</p>';
  html+=button('amounts',shown?'Hide amounts':'Show amounts')+button('manage',manage?'Show visible accounts':'Manage all accounts');
  html+=rows.length?'<ul>'+rows.map(({account:a,accountToken})=>'<li><strong>'+escape(a.label)+'</strong> · '+typeNames[a.type]+
   (a.showInAccountList?'':' · Hidden')+(shown?' · '+escape(savedAccountAmount(a.balanceMinor)):'')+' '+button('edit-'+accountToken,'Edit '+a.label)+'</li>').join('')+'</ul>':'<p>No accounts to display.</p>';
  return html+button('add','Add account',view.accounts.length>=100)+button('close','Close manual accounts');
 }
 return {render,reset,blocked:()=>Boolean(draft||busy),input(event){
  const el=event.target;
  if(el.form?.id!=='manual-account-edit')return false;
  if(draft&&!busy&&!review && ['label','balance','type','includeInBudget','showInAccountList'].includes(el.name))
   draft[el.name]=el.type==='checkbox'?el.checked:el.value;
  return true;
 },submit(event){
  if(event.target.id!=='manual-account-edit')return false;
  event.preventDefault();if(draft&&fresh()&&!review&&!busy)void prepare();return true;
 },click(event){
  const action=event.target.closest('[data-manual-account]')?.dataset.manualAccount;
  if(!action)return false;
  if(busy)return true;
  if(action==='load'){if(canOpen())void load();return true;}
  if(!fresh())return true;
  if(action==='back'&&review){review=null;redraw();}
  else if(action==='save'&&review)void save();
  else if(action==='cancel'&&draft){void load();}
  else if(!draft && canOpen()){
   if(action==='add'||action.startsWith('edit-'))edit(action==='add'?null:action.slice(5));
   if(action==='manage'){manage=!manage;redraw();}
   if(action==='amounts'){shown=!shown;redraw();}
   if(action==='close'){reset();void client.manualAccountsCancel().catch(()=>{});redraw();}
  }
  return true;
 }};
}
