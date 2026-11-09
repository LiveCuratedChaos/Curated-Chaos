import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGoogleSourceSelection as validate} from '../server/google-source-selection.mjs';
test('source selection excludes import approval and rejects impossible dates or excessive windows',()=>{
 const input={source:'INBOX',startDate:'2026-11-01',endDate:'2026-11-08',importApproved:true};
 const result=validate('gmail',input);assert.equal(result.importApproved,false);assert.equal(result.content,'metadata-only');assert.deepEqual(result.labelIds,['INBOX']);
 for(const change of [{source:'ALL'},{startDate:'2026-02-30'},{endDate:'2026-11-01'},{endDate:'2027-01-01'}])assert.throws(()=>validate('gmail',{...input,...change}));
 assert.deepEqual(validate('google_calendar',{...input,source:'primary'}).calendarIds,['primary']);
 assert.throws(()=>validate('unknown',input));
});
