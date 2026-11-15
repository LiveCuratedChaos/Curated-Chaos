import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,chmod,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';
test('native handoff reader rejects public files, links, expired grants and non-loopback destinations',{skip:process.platform!=='darwin'},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cc-native-transfer-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const source=await readFile(new URL('../native/calendar-preview/MacCalendarTransfer.swift',import.meta.url),'utf8');const reader=source.slice(0,source.indexOf('extension PreviewController'));
 const main=join(dir,'main.swift'),binary=join(dir,'check');await writeFile(main,reader+'\nenum PreviewError: Error { case invalidWindow }\ndo { _ = try readMacTransferGrant(CommandLine.arguments[1]); exit(0) } catch { exit(1) }\n');execFileSync('/usr/bin/xcrun',['swiftc',main,'-o',binary]);
 const path=join(dir,'grant.json'),fixture={endpoint:'http://127.0.0.1:5301/auth/google/mac-calendar-transfer',capability:'f'.repeat(43),expiresAt:Date.now()+200000,scope:{calendarCount:1,maxEvents:1,startDate:'2026-11-08',endDateExclusive:'2026-11-09',timeZone:'America/New_York'}};
 const valid=()=>spawnSync(binary,[path]).status===0;
 await writeFile(path,JSON.stringify(fixture),{mode:0o600});assert.equal(valid(),true);
 await chmod(path,0o644);assert.equal(valid(),false);await chmod(path,0o600);
 for(const patch of [{endpoint:'https://example.test/'},{endpoint:'http://localhost:5301/auth/google/mac-calendar-transfer'},{expiresAt:Date.now()-1000},{capability:'invalid'}]){await writeFile(path,JSON.stringify({...fixture,...patch}));assert.equal(valid(),false);}
 await writeFile(path,JSON.stringify(fixture));const link=join(dir,'link');await symlink(path,link);assert.notEqual(spawnSync(binary,[link]).status,0);
 assert.doesNotMatch(source,/\.save\(|\.remove\(|write\(to:|UserDefaults|SecItem/);assert.match(source,/completionHandler\(nil\)/);assert.match(source,/URLSessionConfiguration\.ephemeral/);
});
test('native all-day conversion preserves covered dates across both daylight-saving changes',{skip:process.platform!=='darwin'},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cc-native-calendar-dates-'));t.after(()=>rm(dir,{recursive:true,force:true}));const source=await readFile(new URL('../native/calendar-preview/CalendarPreview.swift',import.meta.url),'utf8');
 const model=source.slice(source.indexOf('struct CalendarWindow'),source.indexOf('final class PreviewController')),checks=source.slice(source.indexOf('func selfTest()'),source.indexOf('if CommandLine.arguments.contains("--self-test")'));
 const main=join(dir,'main.swift'),binary=join(dir,'check');await writeFile(main,'import Foundation\n'+model+'\n'+checks+'\nexit(selfTest() ? 0 : 1)\n');execFileSync('/usr/bin/xcrun',['swiftc',main,'-o',binary]);assert.equal(spawnSync(binary,[]).status,0);
});

test('native transfer emits identifiers only in separately enabled review mode and encodes absent recurrence safely',{skip:process.platform!=='darwin'},async t=>{
 const dir=await mkdtemp(join(tmpdir(),'cc-native-calendar-payload-'));t.after(()=>rm(dir,{recursive:true,force:true}));const modelSource=await readFile(new URL('../native/calendar-preview/CalendarPreview.swift',import.meta.url),'utf8'),transfer=await readFile(new URL('../native/calendar-preview/MacCalendarTransfer.swift',import.meta.url),'utf8');
 const model=modelSource.slice(modelSource.indexOf('struct CalendarWindow'),modelSource.indexOf('final class PreviewController')),builder=transfer.slice(transfer.indexOf('func macCalendarTransferEvents('),transfer.indexOf('func installMacTransferObserver()'));
 const checks=`let event = EventSnapshot(title: "Fictional", start: Date(timeIntervalSince1970: 100), end: Date(timeIntervalSince1970: 200), allDay: false, calendarTitle: "Fictional", calendarId: "PRIVATE_CALENDAR", eventId: "PRIVATE_EVENT")
 do { let plain = try macCalendarTransferEvents([event], identityReview: false); guard plain[0]["calendarId"] == nil, plain[0]["eventId"] == nil else { exit(1) }
 let reviewed = try macCalendarTransferEvents([event], identityReview: true); let data = try JSONSerialization.data(withJSONObject: reviewed); let decoded = try JSONSerialization.jsonObject(with: data) as! [[String: Any]]; guard decoded[0]["calendarId"] as? String == "PRIVATE_CALENDAR", decoded[0]["occurrenceStart"] is NSNull else { exit(1) }; exit(0) } catch { exit(1) }`;
 const main=join(dir,'main.swift'),binary=join(dir,'check');await writeFile(main,'import Foundation\n'+model+'\n'+builder+'\n'+checks);execFileSync('/usr/bin/xcrun',['swiftc',main,'-o',binary]);assert.equal(spawnSync(binary,[]).status,0);
});
