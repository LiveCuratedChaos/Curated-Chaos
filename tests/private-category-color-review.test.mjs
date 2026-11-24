import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBriefPreferencesRecord} from '../src/dev-preferences-model.mjs';
import {createPrivatePreferencesReview} from '../server/private-preferences-review.mjs';

const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const row=()=>({id,owner_id:owner,deleted_at:null,version:3,...makeBriefPreferencesRecord({palette:'coastal',density:'compact',categoryColors:{sections:{Work:'accent'},items:{}}},owner)});

test('category colors require an explicit complete preferences review scope',()=>{
 const source=row(),review=createPrivatePreferencesReview();
 const current=review.read([source],owner);
 assert.equal(current.preferences.categoryColors.sections.Work,'accent');
 assert.throws(()=>review.prepare([source],owner,{baseTag:current.baseTag,changes:{palette:'coastal',density:'compact',hideAmounts:true,categoryColors:{sections:{Work:'warning'},items:{}}}}),/Reviewed appearance fields required/);
 review.dispose();
});

test('reviewed category changes are bounded, owner-private and preserve unrelated settings',()=>{
 const source=row();source.payload.futurePreference={retained:true};
 const review=createPrivatePreferencesReview({allowCategoryColors:true});
 const current=review.read([source],owner);
 const changes={palette:'coastal',density:'compact',hideAmounts:true,categoryColors:{sections:{Work:'warning',School:'positive'},items:{}}};
 const pending=review.prepare([source],owner,{baseTag:current.baseTag,changes});
 assert.deepEqual(pending.changes.map(change=>change.field),['categoryColors']);
 assert.deepEqual(pending.payload.categoryColors,changes.categoryColors);
 assert.deepEqual(pending.payload.futurePreference,{retained:true});
 const saved={...source,version:4,payload:pending.payload};
 assert.equal(review.confirmed([saved],owner,pending).preferences.categoryColors.sections.Work,'warning');
 assert.throws(()=>review.prepare([source],owner,{baseTag:current.baseTag,changes:{...changes,categoryColors:{sections:{Unsupported:'accent'},items:{}}}}),/Supported appearance or category selection/);
 assert.throws(()=>review.prepare([source],owner,{baseTag:'stale',changes}),/Settings changed/);
 review.dispose();
});
