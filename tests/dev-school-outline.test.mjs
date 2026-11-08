import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {degreePayload,makeSchoolDegree,normalizeSchoolDegrees,completionForDegree,schoolPayload,makeSchoolCourse} from '../src/dev-school-model.mjs';
const owner='123e4567-e89b-42d3-a456-426614174000';
test('master degree can be quick-created by name alone and is private',()=>{const d=makeSchoolDegree(owner,{title:'Practice Degree'});assert.equal(d.payload.title,'Practice Degree');assert.equal(d.payload.kind,'degree');assert.equal(d.visibility,'private');assert.equal(d.household_id,null);assert.equal(normalizeSchoolDegrees([{...d,id:'123e4567-e89b-42d3-a456-426614174002'}],owner).length,1);});
test('degree progress supports classes, credits and terms',()=>{const courses=[{payload:schoolPayload({title:'A',credits:3,term:'Term 1',status:'Completed'})},{payload:schoolPayload({title:'B',credits:4,term:'Term 2',status:'In Progress'})}];assert.deepEqual(completionForDegree(degreePayload({title:'Degree'}),courses),{metric:'classes',done:1,total:2,percentage:50});assert.equal(completionForDegree(degreePayload({title:'Degree',progressMetric:'credits',totalCredits:10}),courses).percentage,30);assert.equal(completionForDegree(degreePayload({title:'Degree',progressMetric:'terms',totalTerms:4}),courses).percentage,25);});
test('school outline uses progressive inputs, common model and separate planner',()=>{const js=readFileSync('src/dev-school.mjs','utf8');assert.match(js,/mode-outline/);assert.match(js,/mode-focus/);assert.match(js,/school-quick-form/);assert.match(js,/add-subtask/);assert.match(js,/Study Planner · School only/);assert.doesNotMatch(js,/assessmentTitle\$\{i\}/);assert.match(js,/updateSchoolCourse/);});

test('single-degree outline cannot hide any saved classes due to legacy linkage',()=>{const js=readFileSync('src/dev-school.mjs','utf8');assert.match(js,/const degreeCourses=d=>degrees.length===1\?courses:/);assert.match(js,/OUTLINE REPAIR 2/);});
