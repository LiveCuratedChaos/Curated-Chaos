import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
export async function accountScreen(screen='account'){
 if(!['account','settings'].includes(screen))throw Error('Unsupported preferences fixture.');
 const url=new URL('../../src/dev-'+screen+'.mjs',import.meta.url),source=await readFile(url,'utf8'),bindings={};
 // Supply only bindings actually declared by this screen, so a missing import cannot be hidden by the harness.
 for(const match of source.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/gm)){const exports=await import(new URL(match[2],url).href);for(const name of match[1].split(',')){const [original,alias]=name.trim().split(/\s+as\s+/);bindings[alias||original]=exports[original];}}
 const events={},root={innerHTML:'',addEventListener(name,fn){events[name]=fn;}},context=vm.createContext({...bindings,FormData:class{constructor(form){this.values=form.values||{};}get(name){return this.values[name]??null;}has(name){return Object.hasOwn(this.values,name)&&this.values[name]!==false;}},document:{getElementById:()=>root,body:{dataset:{}}},window:{},location:{href:'http://127.0.0.1:5301/dev-account.html'}}),boot=source.indexOf('(async()=>{try{const response=await fetch');assert.ok(boot>0);vm.runInContext(source.slice(0,boot).replace(/^import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?\s*$/gm,''),context);return{context,root,events};
}
