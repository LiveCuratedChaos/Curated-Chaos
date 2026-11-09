import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
test('local calendar helper build defaults offline without Calendar access or creation',()=>{
 const output=execFileSync(process.execPath,[fileURLToPath(new URL('../tools/build-calendar-preview.mjs',import.meta.url))],{encoding:'utf8'});assert.match(output,/PLAN ONLY/);assert.match(output,/no Calendar permission requested/);assert.match(output,/real access needs separate owner approval/);
});
test('calendar helper has no event mutation, credential, database, network or export surface',()=>{
 const source=readFileSync(new URL('../native/calendar-preview/CalendarPreview.swift',import.meta.url),'utf8');assert.doesNotMatch(source,/\.(save|remove|commit)\s*\(|URLSession|URLRequest|Data\(contentsOf|write\(to:|UserDefaults|SecItem/);assert.match(source,/requestFullAccessToEvents/);assert.match(source,/window\.isRestorable = false/);assert.match(source,/details\.isRichText = false/);
});
