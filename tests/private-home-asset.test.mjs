import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHomeAsset,readHomeAsset} from '../src/private-home-asset.mjs';
import {projectFields} from '../src/private-project-model.mjs';
const asset={kind:'vehicle',make:'Honda',model:'CR-V',year:'2024',usageUnit:'miles',usageEntries:[{day:'2026-01-02',value:120,note:'Oil change'},{day:'2026-05-11',value:420,note:''}],warrantyEndDay:'2029-05-11',receiptNote:'Glovebox folder'};
test('Home asset profiles preserve supported private vehicle and possession details',()=>{
 assert.deepEqual(normalizeHomeAsset(asset),asset);
 const possession={...asset,kind:'possession',make:'Bosch',model:'Dishwasher',year:'2023',usageUnit:'cycles'};
 assert.deepEqual(normalizeHomeAsset(possession),possession);
 assert.deepEqual(projectFields({title:'Appliance service',description:'',section:'Home',status:'Planned',homeAsset:possession}).homeAsset,possession);
 assert.throws(()=>projectFields({title:'Application',description:'',section:'Work',status:'Planned',homeAsset:asset}));
});
test('Home asset validation rejects invalid units, dates, readings, chronology and widened data',()=>{
 for(const bad of [
  {...asset,usageUnit:'hours'}, {...asset,usageEntries:[{day:'2026-02-30',value:1,note:''}]},
  {...asset,usageEntries:[{day:'2026-05-11',value:420,note:''},{day:'2026-01-02',value:430,note:''}]},
  {...asset,usageEntries:[{day:'2026-01-02',value:420,note:''},{day:'2026-05-11',value:419,note:''}]},
  {...asset,usageEntries:[{day:'2026-01-02',value:-1,note:''}]},
  {...asset,receiptNote:'bad\nvalue'}, {...asset,unexpected:true}, {...asset,year:'1800'}
 ]) assert.equal(readHomeAsset(bad),null);
 assert.throws(()=>normalizeHomeAsset({...asset,usageEntries:Array(101).fill(asset.usageEntries[0])}));
});
