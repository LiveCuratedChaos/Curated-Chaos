// Encrypted archive eligibility/roundtrip only; no restore transport or real records.
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {sealPrivateWorkspace,inspectPrivateWorkspace} from '../server/private-workspace-backup.mjs';
import {supportsPrivateSchoolRestore,validatePrivateSchoolRestoreAssociations} from '../server/private-school-restore.mjs';
import {prepareSchoolAcademicIdentities} from '../src/private-school-identities.mjs';
import {makeSchoolCourse} from '../src/dev-school-model.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',projectRef='fictionalidentityrestore',key=Buffer.alloc(32,31);
function record(){const row={...makeSchoolCourse(owner,{title:'Fictional adopted archive course',notes:'\nExact literal notes\n',officialOrder:4,studyOrder:1,assessments:[{title:'Saved assessment',tasks:[{title:'Saved step',done:true}]}],studySessions:[{day:'2026-11-19',time:'10:00',title:'Saved session'}]}),id:randomUUID(),version:8,created_at:'2026-11-17T12:00:00.123456Z',updated_at:'2026-11-18T12:00:00.234567Z',deleted_at:null};row.payload.extension={preserve:true};row.payload.assessments[0].id='external-assessment';row.payload.assessments[0].tasks[0].extension={preserve:'step'};row.payload=prepareSchoolAcademicIdentities(row.payload,randomUUID).payload;return row;}
test('encrypted School archive preserves adopted marker, exact IDs, unknown nested values and microseconds',()=>{
 const row=record(),before=structuredClone(row);assert.equal(supportsPrivateSchoolRestore(row),true);assert.equal(validatePrivateSchoolRestoreAssociations({inserts:[row],existing:[]}),0);const {bytes}=sealPrivateWorkspace({projectRef,ownerId:owner,key,rows:[row]}),opened=inspectPrivateWorkspace(bytes,{key,projectRef,ownerId:owner});assert.deepEqual(opened.records,[before]);assert.deepEqual(row,before);assert.equal(supportsPrivateSchoolRestore(opened.records[0]),true);
});
test('restore eligibility refuses duplicate, missing, malformed and future academic identities',()=>{
 for(const change of [p=>p.academicIdentityVersion=2,p=>p.studySessions[0].academicId=p.assessments[0].academicId,p=>delete p.assessments[0].tasks[0].academicId,p=>p.assessments[0].academicId='invalid']){const row=record();change(row.payload);assert.equal(supportsPrivateSchoolRestore(row),false);}
});
