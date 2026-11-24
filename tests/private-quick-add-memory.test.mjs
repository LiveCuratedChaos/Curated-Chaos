import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuickAddMemory} from '../src/private-quick-add-memory.mjs';

test('only approved task areas are remembered in volatile module state and page destinations win',()=>{
 const memory=createQuickAddMemory();
 assert.equal(memory.sectionFor(),'Personal Life');
 assert.equal(memory.remember('Home'),true);
 assert.equal(memory.sectionFor(),'Home');
 assert.equal(memory.sectionFor('Work'),'Work');
 assert.equal(memory.remember('Finances'),false);
 assert.equal(memory.sectionFor(),'Home');
 memory.clear();
 assert.equal(memory.sectionFor(),'Personal Life');
});

test('Quick Add memory resets with session clearing and is used only after a newly approved task',async()=>{
 const source=await readFile(new URL('../src/dev-private-brief.mjs',import.meta.url),'utf8');
 assert.match(source,/const quickAddMemory=createQuickAddMemory\(\)/);
 assert.match(source,/smartTaskText='';quickAddMemory\.clear\(\);selectedBriefDay/);
 assert.match(source,/rememberedSection=!event&&!editing&&!taskDraft\.homeGrocery&&!taskDraft\.schedule\?taskDraft\.section:''/);
 assert.match(source,/if\(rememberedSection\)quickAddMemory\.remember\(rememberedSection\)/);
 assert.match(source,/last approved task area is remembered in this tab/);
});
