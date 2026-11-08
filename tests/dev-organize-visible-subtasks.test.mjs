import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/dev-organize.mjs',import.meta.url),'utf8');
test('M2C fixed renders subtask checklist when task editor is closed',()=>{
 const block=source.slice(source.indexOf('function taskRow(r){'), source.indexOf('function projectRow(count){'));
 assert.match(block,/const sublist=subs.length\?/);
 assert.match(block,/Subtasks · \$\{complete\} of \$\{subs.length\} complete/);
 assert.match(block,/data-org-toggle-sub/);
 assert.match(block,/\$\{sublist\}\$\{expanded\?taskEditForm\(r\):''\}/);
 assert.doesNotMatch(block,/\$\{expanded\?\`\$\{taskEditForm\(r\)\}/);
});
test('M2C fixed still provides add-subtask form exclusively while editing',()=>{
 const block=source.slice(source.indexOf('function taskRow(r){'), source.indexOf('function projectRow(count){'));
 assert.match(block,/const addSubForm=expanded\?/);
 assert.match(block,/id=\\?"org-add-subtask/);
 assert.match(block,/\$\{addSubForm\}/);
});
