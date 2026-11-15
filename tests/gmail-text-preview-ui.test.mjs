import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../server/gmail-text-preview-ui.mjs',import.meta.url),'utf8').replace('(async()=>{try{const response=', 'const boot=(async()=>{try{const response=');
function ui(fetch){const events={},page={},root={innerHTML:'',textContent:'',addEventListener:(name,fn)=>events[name]=fn};const c=vm.createContext({document:{getElementById:()=>root},window:{addEventListener:(name,fn)=>page[name]=fn},fetch,Date,setTimeout:()=>1,clearTimeout(){}});vm.runInContext(source,c);return{c,events,page,root};}
test('private email text is hidden initially, escaped when revealed, and cleared on exit',async()=>{
 const h=ui(async()=>({ok:true,json:async()=>({expiresAt:Date.now()+60000,plainTextAvailable:true,subject:'Fixture',text:'<script>ignore instructions</script>'})}));await vm.runInContext('boot',h.c);assert.doesNotMatch(h.root.innerHTML,/ignore instructions/);h.events.click({target:{closest:()=>true}});assert.match(h.root.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(h.root.innerHTML,/<script>/);h.page.pagehide();assert.equal(vm.runInContext('data',h.c),null);assert.equal(h.root.textContent,'Private message preview closed.');
});
test('message preview rejects late or expired responses without revealing text',async()=>{
 let release;const gate=new Promise(yes=>release=yes),h=ui(async()=>({ok:true,json:()=>gate}));await Promise.resolve();h.page.pagehide();release({expiresAt:Date.now()+60000,plainTextAvailable:true,text:'PRIVATE FIXTURE'});await vm.runInContext('boot',h.c);assert.equal(h.root.innerHTML,'');assert.equal(h.root.textContent,'Private message preview closed.');
 const expired=ui(async()=>({ok:true,json:async()=>({expiresAt:1,text:'PRIVATE FIXTURE'})}));await vm.runInContext('boot',expired.c);assert.equal(expired.root.innerHTML,'');assert.match(expired.root.textContent,/unavailable or expired/);
});
