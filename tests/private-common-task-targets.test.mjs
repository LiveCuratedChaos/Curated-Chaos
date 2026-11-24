import test from 'node:test';import assert from 'node:assert/strict';
import {resolveCommonProjectTarget,resolveCommonTaskSource} from '../server/private-common-task-targets.mjs';
import {makeSchoolDegree,makeSchoolCourse} from '../src/dev-school-model.mjs';
import {prepareSchoolAcademicIdentities} from '../src/private-school-identities.mjs';
import {applySchoolAcademicRecovery} from '../src/private-school-academic-recovery.mjs';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id=n=>'abcdabcd-abcd-4bcd-8bcd-'+String(n).padStart(12,'0'),stamp='2026-11-19T12:00:00.000001Z';
const meta=(r,n)=>({...r,id:id(n),owner_id:owner,household_id:null,visibility:'private',version:1,deleted_at:null,created_at:stamp,updated_at:stamp});
function fixtures(){let n=100;const course=meta(makeSchoolCourse(owner,{title:'Original course',status:'In Progress',notes:'\nExact <notes>',assessments:[{title:'Same title',type:'Objective Assessment',status:'Submitted',tasks:[{title:'Same title',done:true}]},{title:'Same title',type:'Other',status:'In Progress',tasks:[{title:'Same title',done:false}]}],studySessions:[]}),1);course.payload=prepareSchoolAcademicIdentities(course.payload,()=>id(n++)).payload;course.payload.extension={keep:'Unknown canonical extension'};return{course,degree:meta(makeSchoolDegree(owner,{title:'Original program'}),2),project:meta({section:'Work',item_type:'project',origin:'PRIVATE_COOKIE_PROJECT',payload:{fictional:true,schemaVersion:1,title:'Original manual project',description:'\nExact details',status:'Active'}},3),task:meta({section:'Work',item_type:'task',origin:'PRIVATE_COOKIE_TASK',payload:{fictional:true,title:'Original manual task',done:false}},4)};}
const projectRef=(kind,row,extra={})=>({kind,recordId:row.id,...extra});
test('canonical project targets retain distinct manual and academic status domains without record copies',()=>{
 const f=fixtures();for(const [kind,row]of [['project',f.project],['school-degree',f.degree],['school-course',f.course]]){const before=structuredClone(row),resolved=resolveCommonProjectTarget(row,owner,projectRef(kind,row));assert.equal(resolved.reference.recordId,row.id);assert.deepEqual(resolved.source,row);assert.notEqual(resolved.source,row);assert.equal(resolved.statusDomain,kind==='project'?'manual':kind==='school-course'?'academic':null);resolved.source.payload.title='Detached mutation';assert.deepEqual(row,before);}
});
test('duplicate academic titles resolve only by stable active identity and exact original parent',()=>{
 const {course}=fixtures(),[a,b]=course.payload.assessments;
 const target=resolveCommonProjectTarget(course,owner,projectRef('school-assessment',course,{academicId:a.academicId}));assert.equal(target.status,'Submitted');assert.equal(target.reference.academicId,a.academicId);
 const source=resolveCommonTaskSource(course,owner,projectRef('school-step',course,{assessmentId:b.academicId,academicId:b.tasks[0].academicId}));assert.equal(source.completed,false);assert.deepEqual(source.source.payload.extension,course.payload.extension);
 assert.throws(()=>resolveCommonTaskSource(course,owner,projectRef('school-step',course,{assessmentId:a.academicId,academicId:b.tasks[0].academicId})));
});
test('manual task resolution references the original task and never infers completion from a project',()=>{const {task}=fixtures(),result=resolveCommonTaskSource(task,owner,projectRef('task',task));assert.equal(result.completed,false);assert.deepEqual(result.source,task);assert.notEqual(result.source,task);});
test('legacy or missing academic identities cannot silently become shared targets',()=>{
 const {course}=fixtures(),a=course.payload.assessments[0],ref=projectRef('school-assessment',course,{academicId:a.academicId});delete course.payload.academicIdentityVersion;assert.throws(()=>resolveCommonProjectTarget(course,owner,ref));
});
test('removed academic snapshots remain retained but cannot resolve as active shared targets',()=>{
 const {course}=fixtures(),a=course.payload.assessments[0],ref=projectRef('school-assessment',course,{academicId:a.academicId});course.payload=applySchoolAcademicRecovery(course.payload,{action:'remove-assessment',assessmentId:a.academicId},{now:Date.parse('2026-11-19T12:00:00Z'),idFactory:()=>id(900)}).payload;
 assert.throws(()=>resolveCommonProjectTarget(course,owner,ref));assert.throws(()=>resolveCommonTaskSource(course,owner,projectRef('school-step',course,{assessmentId:a.academicId,academicId:a.tasks[0].academicId})));assert.equal(course.payload.removedAcademicRecords.length,1);
});
test('unsupported scopes, altered identities, wrong source kinds and malformed references fail closed',()=>{
 for(const mutate of [r=>r.owner_id=id(98),r=>r.household_id=id(97),r=>r.visibility='household',r=>r.deleted_at=stamp,r=>r.payload.schemaVersion=99]){const {course}=fixtures();mutate(course);assert.throws(()=>resolveCommonProjectTarget(course,owner,projectRef('school-course',course)));}
 const {course,degree,project,task}=fixtures();for(const ref of [{kind:'project',recordId:course.id},{kind:'school-course',recordId:course.id,owner_id:owner},{kind:'school-course',recordId:id(77)},{kind:'school-assessment',recordId:course.id,academicId:'bad'}])assert.throws(()=>resolveCommonProjectTarget(course,owner,ref));assert.throws(()=>resolveCommonProjectTarget(degree,owner,projectRef('school-course',degree)));assert.throws(()=>resolveCommonTaskSource(project,owner,projectRef('task',project)));assert.throws(()=>resolveCommonTaskSource(task,undefined,projectRef('task',task)));
});
test('canonical source times preserve microseconds and nested source corruption is not hidden by a valid selected node',()=>{
 const {course}=fixtures(),ref=projectRef('school-course',course),before=resolveCommonProjectTarget(course,owner,ref);course.updated_at='2026-11-19T12:00:00.000002Z';const after=resolveCommonProjectTarget(course,owner,ref);assert.notEqual(before.sourceTimes.updatedAt,after.sourceTimes.updatedAt);course.payload.assessments[1].tasks[0].done='false';assert.throws(()=>resolveCommonProjectTarget(course,owner,ref));
});

test('academic resolver checks the entire identity inventory and preserves canonical ID spelling',()=>{
 const {course}=fixtures(),a=course.payload.assessments[0];a.academicId=a.academicId.toUpperCase();const resolved=resolveCommonProjectTarget(course,owner,projectRef('school-assessment',course,{academicId:a.academicId.toLowerCase()}));assert.equal(resolved.reference.academicId,a.academicId);
 course.payload.assessments[1].tasks[0].academicId=a.tasks[0].academicId;assert.throws(()=>resolveCommonProjectTarget(course,owner,projectRef('school-course',course)));
});
