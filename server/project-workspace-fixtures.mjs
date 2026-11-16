// Synthetic SQL-backed harness only; never used by production composition.
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createProjectWorkspaceRepository} from './project-workspace-repository.mjs';
import {createProjectWorkspaceService} from './project-workspace-service.mjs';
import {createProjectWorkspaceHttp} from './project-workspace-http.mjs';
export const PROJECT_FIXTURE_OWNER='11111111-1111-4111-8111-111111111111';
export const PROJECT_FIXTURE_ORIGIN='https://project-fixture.example.test';
export async function createProjectWorkspaceFixture(){
  const db=new PGlite(),ownerId=PROJECT_FIXTURE_OWNER,csrf='b'.repeat(43);let active=true;
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
    await db.query('insert into auth.users(id) values($1)',[ownerId]);
    await db.exec(await readFile(new URL('../supabase/migrations/001_dev_isolation.sql',import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/drafts/009_project_workspace.sql',import.meta.url),'utf8'));
    const rpc=async(name,args)=>{if(name!=='cc_project_workspace')throw Error('Fixture RPC scope rejected.');try{return{data:(await db.query('select public.cc_project_workspace($1,$2::jsonb) as result',[args.operation,JSON.stringify(args.input)])).rows[0].result,error:null};}catch(error){return{data:null,error:{message:error.message}};}};
    const workspace=createProjectWorkspaceService({repository:createProjectWorkspaceRepository({rpc})});
    const actor=()=>{if(!active)throw Object.assign(Error('Fixture session ended.'),{code:'SESSION_ENDED'});return{ownerId};};
    const sessions={async readWithAccess(_,read){const result=await read(actor());actor();return result;},async writeWithAccess(_,authorize,write){if(!await authorize(actor()))throw Error();const result=await write(actor());actor();return result;},async checkCsrf(_,value){return active&&value===csrf;}};
    const routes=createProjectWorkspaceHttp({origin:PROJECT_FIXTURE_ORIGIN,sessions,workspace});
    return{db,rpc,workspace,actor:{ownerId},async handle(request){
      const url=new URL(request.url),json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      if(url.origin!==PROJECT_FIXTURE_ORIGIN)return json(403,{error:'Fixture origin required.'});
      if(url.pathname==='/api/workspace/session'&&request.method==='GET')return active?json(200,{signedIn:true,fixture:true,csrf,user:{id:ownerId}}):json(401,{error:'Fixture signed out.'});
      if(url.pathname==='/api/workspace/logout'&&request.method==='POST'){
        if(request.headers.get('origin')!==PROJECT_FIXTURE_ORIGIN||request.headers.get('x-cc-csrf')!==csrf)return json(403,{error:'Fixture verification failed.'});
        active=false;return json(200,{signedOut:true,remoteRevoked:true});
      }
      return await routes(request)||json(404,{error:'Not found.'});
    },close:()=>db.close()};
  }catch(error){await db.close();throw error;}
}
