import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateManualBudget, includedManualBalance, normalizeManualBudget, normalizeManualFinanceAccount, validateManualFinanceEnvelope, visibleManualAccounts} from '../src/private-finance-manual.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const checking={label:'Checking',type:'checking',balanceMinor:125050,showInAccountList:true,includeInBudget:true};
const savings={label:'Emergency savings',type:'savings',balanceMinor:500000,showInAccountList:false,includeInBudget:true};
const budget={period:'month',periodStart:'2026-11-01',periodEnd:'2026-11-30',plannedIncomeMinor:400000,allocations:[{category:'Housing',plannedMinor:150000},{category:'Food',plannedMinor:50000}],transactions:[{category:'Housing',day:'2026-11-02',amountMinor:150000},{category:'Food',day:'2026-11-04',amountMinor:65000},{category:'Unplanned',day:'2026-11-10',amountMinor:1000}]};
test('manual account list visibility and aggregate inclusion are independent',()=>{
 assert.deepEqual(normalizeManualFinanceAccount(checking),checking);
 assert.deepEqual(visibleManualAccounts([checking,savings]),[checking]);
 assert.equal(includedManualBalance([checking,savings]),625050);
 assert.equal(includedManualBalance([{...checking,showInAccountList:false,includeInBudget:false}]),0);
 for(const bad of [{...checking,unknown:true},{...checking,balanceMinor:1.5},{...checking,includeInBudget:1},{...checking,type:'bank'},{...checking,label:' x'}])assert.throws(()=>normalizeManualFinanceAccount(bad));
});
test('manual account contract refuses shared, foreign, deleted and malformed records',()=>{
 const row={owner_id:owner,household_id:null,visibility:'private',section:'Finances',item_type:'manual_finance_account',origin:'PRIVATE_MANUAL_FINANCE',deleted_at:null,version:2,payload:{account:checking,fictional:true,ownerId:owner,version:1}};
 assert.deepEqual(validateManualFinanceEnvelope(row,owner),checking);
 for(const patch of [{owner_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},{household_id:owner},{visibility:'household'},{section:'Personal Life'},{deleted_at:'2026-11-01'},{version:0},{origin:'OTHER'}])assert.throws(()=>validateManualFinanceEnvelope({...row,...patch},owner));
});
test('monthly and pay-period budgets use exact cents and report unallocated funds, overspending and unmatched actuals',()=>{
 const result=calculateManualBudget(budget);
 assert.equal(result.period,'month');assert.equal(result.plannedAllocationsMinor,200000);assert.equal(result.unallocatedMinor,200000);assert.equal(result.zeroBased,false);
 assert.deepEqual(result.categories,[{category:'Housing',plannedMinor:150000,actualMinor:150000,remainingMinor:0,overspentMinor:0},{category:'Food',plannedMinor:50000,actualMinor:65000,remainingMinor:-15000,overspentMinor:15000}]);assert.equal(result.unallocatedActualMinor,1000);
 const pay={...budget,period:'pay_period',plannedIncomeMinor:200000,periodStart:'2026-11-01',periodEnd:'2026-11-14',allocations:[{category:'Housing',plannedMinor:200000}],transactions:[]};assert.equal(calculateManualBudget(pay).zeroBased,true);assert.equal(calculateManualBudget(pay).unallocatedMinor,0);
});
test('budget model rejects date, category, sign, duplicate and safe-integer violations',()=>{
 for(const bad of [{...budget,period:'weekly'},{...budget,periodEnd:'2026-02-30'},{...budget,allocations:[{category:'Food',plannedMinor:-1}]},{...budget,allocations:[{category:'Food',plannedMinor:1},{category:'Food',plannedMinor:2}]},{...budget,transactions:[{category:'Food',day:'2026-12-01',amountMinor:1}]},{...budget,transactions:[{category:'Food',day:'2026-11-01',amountMinor:-1}]}])assert.throws(()=>normalizeManualBudget(bad));
 assert.throws(()=>calculateManualBudget({...budget,plannedIncomeMinor:Number.MAX_SAFE_INTEGER,allocations:[{category:'A',plannedMinor:Number.MAX_SAFE_INTEGER},{category:'B',plannedMinor:1}]}));
 assert.throws(()=>includedManualBalance([{...checking,balanceMinor:Number.MAX_SAFE_INTEGER},{...checking,balanceMinor:1}]));
});
