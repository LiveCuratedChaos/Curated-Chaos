import test from 'node:test';
import assert from 'node:assert/strict';
import {holdingInputs,holdingSummary,formatShares,parseShares} from '../src/private-holdings.mjs';
const row=(kind,day,amountMinor,shares)=>({kind,day,amountMinor,shareUnits:parseShares(shares)});
const sample={label:'Example holding',price:{day:'2026-06-01',amountMinor:1100},annualDividendMinor:20,activities:[
 row('buy','2026-01-10',10000,'10'),row('dividend','2026-03-01',120,'0'),row('reinvest','2026-04-01',200,'0.2'),row('sell','2026-05-01',2300,'2'),row('buy','2026-07-01',1000,'1')]};
test('as-of value and gain count cash and reinvested dividends once and omit later activities',()=>{
 const summary=holdingSummary(sample);assert.deepEqual(summary,{shareUnits:9200000,cashDividendsMinor:120,reinvestedDividendsMinor:200,estimatedAnnualDividendMinor:184,
  valuation:{asOf:'2026-06-01',shareUnits:8200000,marketValueMinor:9020,purchaseOutlayMinor:10000,saleProceedsMinor:2300,cashDividendsMinor:120,gainMinor:1440}});
 assert.equal(holdingSummary({...sample,annualDividendMinor:null,price:null}).valuation,null);
 assert.equal(holdingSummary({...sample,annualDividendMinor:null}).estimatedAnnualDividendMinor,null);
});
test('holding activity respects historical available shares and exact microshares and rounds valuation in cents',()=>{
 assert.equal(formatShares(parseShares('120.010010')),'120.01001');assert.equal(formatShares(parseShares('0.000001')),'0.000001');assert.throws(()=>parseShares('0.0000001'));
 assert.throws(()=>holdingSummary({...sample,activities:[row('sell','2026-01-01',200,'1'),...sample.activities]}));
 assert.equal(holdingSummary({...sample,activities:[row('buy','2026-01-01',1,'0.5')],price:{day:'2026-01-01',amountMinor:1}}).valuation.marketValueMinor,1);
 assert.throws(()=>holdingInputs({...sample,price:{amountMinor:10}}));
});

import {privateWorkspaceFixture} from './support/private-workspace-fixture.mjs';
import {createHoldingPanel} from '../src/private-holding-panel.mjs';
import {validatePrivatePreviewArguments} from '../tools/private-session-preview-server.mjs';

test('signed-in holdings support reviewed manual price, purchase, dividend, reinvestment and stale correction refusal',async t=>{
 const app=privateWorkspaceFixture(t,{allowManualFinance:true,allowHoldings:true}),a=app.tab(),b=app.tab();
 await a.login();await b.login();
 const panel=createHoldingPanel({client:a.client});t.after(()=>panel.reset());
 const turn=()=>new Promise(r=>setImmediate(r));
 const click=async action=>{panel.click({target:{closest:()=>({dataset:{holdingAction:action}})}});await turn();};
 const input=(name,value)=>panel.input({target:{form:{id:'holding-edit'},name,value}});
 const review=async()=>{panel.submit({target:{id:'holding-edit'},preventDefault(){}});await turn();};
 async function select(){const m=/data-holding-action="(select-[^"]+)"/.exec(panel.render());assert.ok(m,panel.render());await click(m[1]);}
 await click('load');await click('add');input('label','Example holding');input('price','11.00');input('date','2026-06-01');input('annual','0.20');
 await review();assert.match(panel.render(),/Owner-entered price/);await click('approve');await select();
 async function record(kind,day,amount,qty){await click('activity');input('kind',kind);input('day',day);input('amount',amount);if(qty)input('shares',qty);await review();await click('approve');await select();}
 await record('buy','2026-01-10','100','10');await record('dividend','2026-03-01','1.20');await record('reinvest','2026-04-01','2','0.2');
 assert.match(panel.render(),/10\.2 shares recorded/);assert.doesNotMatch(panel.render(),/112\.20/);
 await click('amounts');assert.match(panel.render(),/\$112\.20/);assert.match(panel.render(),/\$13\.40/);assert.match(panel.render(),/Estimated annual dividends · \$2\.04/);
 const one=(await a.client.manualHoldingList()).holdings[0],two=(await b.client.manualHoldingList()).holdings[0];
 assert.deepEqual(Object.keys(one).sort(),['holdingToken','label','version']);
 const activity=row('sell','2026-05-01',1500,'1');
 const r=await a.client.manualHoldingReview({holdingToken:one.holdingToken,index:null,activity});
 const r2=await b.client.manualHoldingReview({holdingToken:two.holdingToken,index:0,activity:row('buy','2026-01-10',10000,'11')});
 await a.client.manualHoldingSave(r.reviewId);await assert.rejects(b.client.manualHoldingSave(r2.reviewId));await assert.rejects(a.client.manualHoldingSave(r.reviewId));
 const h=(await b.client.manualHoldingList()).holdings[0];const read=await b.client.manualHoldingRead({holdingToken:h.holdingToken});
 assert.equal(read.holding.activities.length,4);
 await assert.rejects(b.client.manualHoldingReview({holdingToken:h.holdingToken,index:0,activity:row('buy','2026-07-01',100,'1')}));
 await assert.rejects(b.client.manualHoldingReview({holdingToken:h.holdingToken,index:null,activity:row('buy','2099-01-01',100,'1')}));
 assert.equal((await(await a.fetcher('/dev-config.json')).json()).privateManualHoldings,true);
 assert.equal(validatePrivatePreviewArguments(['--fixtures-only','--serve-private-dashboard','--allow-private-brief-read','--allow-private-manual-finance-reviewed','--allow-private-manual-holdings-reviewed']).allowHoldings,true);
});

test('an expired holding draft releases navigation without exposing or saving the draft',async t=>{
 const {createHoldingPanel}=await import('../src/private-holding-panel.mjs');
 let now=Date.parse('2026-11-18T12:00:00Z'),reads=0;
 const panel=createHoldingPanel({client:{manualHoldingList:async()=>{reads++;return {holdings:[],expiresAt:now+1000};}},
  clock:()=>now,canOpen:()=>!panel.blocked()});
 t.after(()=>panel.reset());
 const click=async holdingAction=>{
  panel.click({target:{closest:()=>({dataset:{holdingAction}})}});
  await new Promise(resolve=>setImmediate(resolve));
 };
 await click('load');
 await click('add');
 panel.input({target:{name:'label',value:'Fictional private holding draft',form:{id:'holding-edit'}}});
 assert.equal(panel.blocked(),true);
 assert.match(panel.render(),/Fictional private holding draft/);
 now+=1001;
 assert.equal(panel.blocked(),false);
 assert.doesNotMatch(panel.render(),/Fictional private holding draft/);
 await click('load');
 assert.equal(reads,2);
 assert.match(panel.render(),/Add holding/);
});
