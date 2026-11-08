import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {schoolPayload} from '../src/dev-school-model.mjs';
const script=readFileSync(new URL('../src/dev-school.mjs',import.meta.url),'utf8');
test('course retains stable degree id when supplied',()=>{
  const id='123e4567-e89b-42d3-a456-426614174000';
  const c=schoolPayload({title:'Demo',degreeId:id,program:'Demo Degree'});
  assert.equal(c.degreeId,id);assert.equal(schoolPayload(c).degreeId,id);
});
test('outline groups by stable degree id and shows unmatched saved courses',()=>{
  assert.match(script,/c\.payload\.degreeId===d\.id/);
  assert.match(script,/Classes not linked to a degree/);
  assert.match(script,/degreeId:d\.id/);
});
