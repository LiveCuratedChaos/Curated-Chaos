import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allowedPublicPath} from '../tools/local-server.mjs';
import {WORKSPACE_PAGES,QA_PAGES,MOBILE_TABS,safeWorkspacePage,workspaceHref} from '../src/dev-navigation-model.mjs';
import {renderConnectedShell} from '../src/dev-cloud-shell.mjs';
import {workspaceCards,workspaceHeading} from '../src/dev-workspace-model.mjs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const info=(title,day='2026-11-01',section='Personal Life',item_type='task')=>({section,item_type,payload:{title,day,fictional:true}});
const base={tasks:[info('<script>unsafe</script>'),info('Home QA','2026-11-02','Home'),info('Work QA','2026-11-03','Work'),info('School QA','2026-11-04','School')],notes:[info('Private Note','2026-11-01','Personal Life','note')],events:[{...info('Calendar test','2026-11-05','Calendar','event'),payload:{title:'Calendar test',day:'2026-11-05',time:'10:30',fictional:true}}],life:[info('Sample utility bill','2026-11-06','Finances','bill_fixture'),info('Sample course assessment','2026-11-07','School','school_fixture'),info('Sample kitchen reset','2026-11-08','Home','household_fixture')],emails:[info('Sample appointment','2026-11-09','Email','email_fixture')]};
test('M2A: all core workspace pages map to bounded, functional links',()=>{
 assert.deepEqual(WORKSPACE_PAGES.filter(x=>x.group==='chaos').map(x=>x.id),['home','calendar','personal','work','school','finances']);
 assert.equal(workspaceHref('account'),'/dev-account.html');
 assert.equal(safeWorkspacePage('evil<script>'),'curation');
 assert.equal(workspaceHref('https://evil.test/'),' /dev-workspace.html?page=curation'.trim());
 for(const p of WORKSPACE_PAGES){assert.equal(workspaceHeading(p.id).title,p.title);assert.match(renderConnectedShell('test',{active:'workspace',workspace:p.id}),new RegExp('href="'+workspaceHref(p.id).replaceAll('?','\\?')+'"'));}
 assert.throws(()=>renderConnectedShell('test',{active:'invalid'}));
});
test('M2A: mobile has exactly four primary tabs plus More',()=>{
 assert.equal(MOBILE_TABS.length,5);assert.deepEqual(MOBILE_TABS.map(x=>x.id),['brief','curation','calendar','home','more']);
 const html=renderConnectedShell('<p>safe</p>',{active:'workspace',workspace:'calendar'});
 assert.match(html,/<nav class="bottom-tabs" aria-label="Mobile navigation">/);
 assert.match(html,/aria-current="page" href="\/dev-calendar.html"/);
 assert.match(html,/Skip to content/);
 assert.match(html,/Development tools/);
 assert.match(html,/CHAOS/);
 assert.match(html,/My Account/);
 for(const p of QA_PAGES)assert.match(html,new RegExp(p.href.replaceAll('.','\\.')));
});
test('M2A: placeholder pages are explicitly labelled and expose previous working QA routes',()=>{
 for(const p of WORKSPACE_PAGES){
   const html=workspaceCards(p.id,base);
   assert.ok(html.length>90,p.id);
   if(p.id!=='more')assert.match(html,/M1 connected/);
 }
 assert.match(workspaceCards('curation',base),/Private test tasks/);
 assert.match(workspaceCards('calendar',base),/Calendar test/);
 assert.match(workspaceCards('school',base),/Sample course assessment/);
 assert.match(workspaceCards('work',base),/Work QA/);
 assert.match(workspaceCards('personal',base),/Private Note/);
});
test('M2A corrected: The Curation includes school, finance and household fixture cards',()=>{
 const html=workspaceCards('curation',base);
 for(const title of ['School reminders','Finances · saved bills','Household reminders'])assert.match(html,new RegExp(title));
 for(const record of ['Sample course assessment','Sample utility bill','Sample kitchen reset'])assert.match(html,new RegExp(record));
 assert.match(html,/href="\/dev-life\.html"/);
 const noFixtures=workspaceCards('curation',{...base,life:[]});
 assert.match(noFixtures,/School reminders/);
 assert.match(noFixtures,/Household reminders/);
 assert.match(noFixtures,/No saved fictional records in this area yet/);
});
test('M2A corrected: The Curation masks bill amounts and escapes fictional source titles',()=>{
 const fake={...base,life:[
   {...base.life[0],payload:{...base.life[0].payload,amount:86.40,title:'Sample utility bill <script>not-safe</script>'}},
   ...base.life.slice(1)
 ]};
 const html=workspaceCards('curation',fake);
 assert.doesNotMatch(html,/86\.40|\$86|<script>not-safe<\/script>/);
 assert.match(html,/&lt;script&gt;not-safe&lt;\/script&gt;/);
});
test('M2A: financial preview never exposes numeric fictional bill amount',()=>{
 const fake={...base,life:[{...base.life[0],payload:{title:'Sample utility bill',day:'2026-11-06',amount:86.40,fictional:true}}]};
 const html=workspaceCards('finances',fake);
 assert.match(html,/Sample utility bill/);
 assert.doesNotMatch(html,/86\.40|\$86/);
});
test('M2A: all cloud-provided text is escaped and navigation links are whitelisted',()=>{
 const output=workspaceCards('curation',base);
 assert.doesNotMatch(output,/<script>unsafe<\/script>/);
 assert.match(output,/&lt;script&gt;unsafe&lt;\/script&gt;/);
 assert.doesNotMatch(output,/href="https?:/);
});
test('M2A: new workspace routes are allowlisted but local credentials and migrations are not',()=>{
 for(const path of ['/dev-workspace.html','/src/dev-workspace.mjs','/src/dev-workspace-model.mjs','/src/dev-navigation-model.mjs'])assert.equal(allowedPublicPath(path),true,path);
 for(const path of ['/.env.local','/README.md','/tests/dev-workspace.test.mjs','/supabase/migrations/001_dev_isolation.sql'])assert.equal(allowedPublicPath(path),false,path);
 const js=read('src/dev-workspace.mjs');
 for(const name of ['createDevSessionManager','normalizeCloudRecords','normalizeFictionalEmails','normalizeFictionalLife','readOwnerBriefPreferences','api.listBriefRecords','api.listBriefPreferences'])assert.match(js,new RegExp(name.replaceAll('.','\\.')));
 assert.match(js,/\+\+requestGeneration/);
 assert.doesNotMatch(js,/api\.(addNote|addFictionalTask|updateBriefPreferences|addFictionalEmail)/);
 assert.match(read('dev-workspace.html'),/src="\/src\/dev-workspace.mjs"/);
});
test('M2A: mobile and tablet viewport switch is documented in CSS',()=>{
 const css=read('src/styles.css');assert.match(css,/max-width:940px/);assert.match(css,/max-width:650px/);
 assert.match(css,/cc-m2a-shell \.bottom-tabs/);assert.match(css,/cc-work-grid/);
});
