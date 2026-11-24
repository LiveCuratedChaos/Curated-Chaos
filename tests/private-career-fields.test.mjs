import test from 'node:test';
import assert from 'node:assert/strict';
import {privateCareerFields} from '../src/private-career-fields.mjs';
import {projectFields} from '../src/private-project-model.mjs';

const app={kind:'application',employer:' Example, Inc. ',role:'Senior Analyst',stage:'Phone screen',targetCompensation:'At least $90,000',skills:['Excel','Investigations'],certifications:['CFE']};
test('career metadata supports owner-named application stages and normalized bounded profile lists',()=>{
 assert.deepEqual(privateCareerFields(app),{...app,employer:'Example, Inc.',role:'Senior Analyst'});
 assert.deepEqual(privateCareerFields({...app,kind:'goal',employer:'',stage:''}).kind,'goal');
 assert.equal(privateCareerFields(undefined),undefined);
});
test('career metadata rejects missing application fields, non-Work use, malformed lists and unbounded values',()=>{
 for(const value of [{...app,employer:''},{...app,stage:''},{...app,skills:['Excel',' excel ']},{...app,certifications:Array(31).fill('Cert')},{...app,targetCompensation:'$'.repeat(81)},{...app,extra:'unsupported'}])assert.throws(()=>privateCareerFields(value));
 assert.throws(()=>privateCareerFields(app,{requireCanonical:true}));
 assert.throws(()=>projectFields({title:'Application',description:'',section:'Personal Life',status:'Active',career:privateCareerFields(app)}));
});
