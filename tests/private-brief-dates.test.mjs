import test from 'node:test';import assert from 'node:assert/strict';
import {briefDateRange} from '../src/private-brief-dates.mjs';
test('rolling Brief dates always start at the unchanged anchor and span seven dates',()=>{
 const value=briefDateRange('2026-11-17',{range:'rolling',weekStart:1});assert.deepEqual(value,{anchor:'2026-11-17',range:'rolling',weekStart:1,from:'2026-11-17',to:'2026-11-23',days:['2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22','2026-11-23'],clipped:false});assert.deepEqual(briefDateRange('2026-11-17',{range:'rolling',weekStart:6}).days,value.days);
});
test('calendar Brief dates include the anchor in the configured Sunday or Monday week',()=>{
 const sunday=briefDateRange('2026-11-17',{range:'calendar',weekStart:0}),monday=briefDateRange('2026-11-17',{range:'calendar',weekStart:1});assert.equal(sunday.from,'2026-11-15');assert.equal(sunday.to,'2026-11-21');assert.equal(monday.from,'2026-11-16');assert.equal(monday.to,'2026-11-22');assert.equal(briefDateRange('2026-11-15',{range:'calendar',weekStart:0}).from,'2026-11-15');assert.equal(briefDateRange('2026-11-15',{range:'calendar',weekStart:1}).from,'2026-11-09');assert.ok(sunday.days.includes(sunday.anchor));assert.ok(monday.days.includes(monday.anchor));
});
test('every supported weekday can start a calendar range without shifting the selected date',()=>{
 const starts=['2026-11-15','2026-11-16','2026-11-17','2026-11-11','2026-11-12','2026-11-13','2026-11-14'];for(let weekStart=0;weekStart<7;weekStart++){const value=briefDateRange('2026-11-17',{range:'calendar',weekStart});assert.equal(value.from,starts[weekStart]);assert.equal(value.anchor,'2026-11-17');assert.equal(value.days.length,7);assert.ok(value.days.includes(value.anchor));}
});
test('leap days and year changes remain date-only and include the full supported interval',()=>{
 const leap=briefDateRange('2028-02-27',{range:'rolling',weekStart:0});assert.equal(leap.to,'2028-03-04');assert.ok(leap.days.includes('2028-02-29'));const year=briefDateRange('2026-12-31',{range:'calendar',weekStart:1});assert.equal(year.from,'2026-12-28');assert.equal(year.to,'2027-01-03');assert.equal(briefDateRange('2000-02-29',{range:'rolling',weekStart:0}).from,'2000-02-29');assert.equal(briefDateRange('2100-02-28',{range:'rolling',weekStart:0}).days[1],'2100-03-01');
});
test('spring and autumn daylight-saving transitions never add or drop a date',()=>{
 for(const [anchor,to] of [['2026-03-08','2026-03-14'],['2026-11-01','2026-11-07']]){const value=briefDateRange(anchor,{range:'rolling',weekStart:0});assert.equal(value.to,to);assert.equal(value.days.length,7);for(let i=1;i<7;i++)assert.equal(Date.parse(value.days[i]+'T00:00:00Z')-Date.parse(value.days[i-1]+'T00:00:00Z'),86400000);}
});
test('supported range boundaries clip dates rather than shifting the anchor or filling other dates',()=>{
 const lower=briefDateRange('2000-01-01',{range:'calendar',weekStart:0});assert.deepEqual(lower,{anchor:'2000-01-01',range:'calendar',weekStart:0,from:'2000-01-01',to:'2000-01-01',days:['2000-01-01'],clipped:true});const rolling=briefDateRange('2100-12-31',{range:'rolling',weekStart:0});assert.deepEqual(rolling.days,['2100-12-31']);assert.equal(rolling.clipped,true);assert.equal(rolling.anchor,'2100-12-31');const upper=briefDateRange('2100-12-31',{range:'calendar',weekStart:0});assert.equal(upper.from,'2100-12-26');assert.equal(upper.to,'2100-12-31');assert.equal(upper.days.length,6);assert.equal(upper.clipped,true);assert.equal(briefDateRange('2000-01-01',{range:'calendar',weekStart:6}).clipped,false);assert.equal(briefDateRange('2100-12-31',{range:'calendar',weekStart:6}).clipped,false);
});
test('invalid dates, timestamp strings and coerced range preferences are rejected',()=>{
 for(const anchor of [null,undefined,{},[],true,20261117,'1999-12-31','2101-01-01','2026-02-29','2100-02-29','2026-02-30','2026-13-01','2026-00-01','2026-11-00','2026-11-31','2026-1-17',' 2026-11-17','2026-11-17T00:00:00Z'])assert.throws(()=>briefDateRange(anchor,{range:'rolling',weekStart:0}));
 for(const range of [undefined,null,true,false,{},[],1,'Rolling','week'])assert.throws(()=>briefDateRange('2026-11-17',{range,weekStart:0}));for(const weekStart of [undefined,null,false,true,{},[],1.5,-1,7,NaN,Infinity,'0'])assert.throws(()=>briefDateRange('2026-11-17',{range:'calendar',weekStart}));assert.throws(()=>briefDateRange('2026-11-17'));assert.throws(()=>briefDateRange('2026-11-17',null));
});
