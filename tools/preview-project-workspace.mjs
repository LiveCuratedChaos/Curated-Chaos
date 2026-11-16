// Explicit fictional loopback preview. No .env/.local loaders, credentials or providers.
import {createServer} from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const assets=new Set(['/project-workspace.html','/src/project-workspace.css','/src/project-workspace-entry.mjs','/src/project-workspace-client.mjs','/src/project-workspace-controller.mjs','/src/project-workspace-model.mjs','/src/dev-organize-model.mjs','/src/dev-brief-model.mjs','/src/task-priorities.mjs','/src/core.mjs','/src/project-progress.mjs','/src/task-recurrence.mjs']);
export function validateProjectPreviewArguments(args){
  if(!args.length)return null;
  if(args.length!==1||args[0]!=='--fixtures-only')throw Error('Only explicit fictional mode is supported.');return{fixtures:true};
}
export async function makeProjectWorkspaceFixturePreview(){
  const {createProjectWorkspaceFixture,PROJECT_FIXTURE_ORIGIN}=await import('../server/project-workspace-fixtures.mjs');
  const fixture=await createProjectWorkspaceFixture();let localOrigin;
  const server=createServer(async(req,res)=>{try{
    localOrigin='http://127.0.0.1:'+server.address().port;
    if(req.headers.host!==new URL(localOrigin).host||req.headers.origin&&req.headers.origin!==localOrigin||req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site'])){res.writeHead(403).end('Use the fictional preview address.');return;}
    const url=new URL(req.url,localOrigin);
    if(url.pathname.startsWith('/api/workspace/')){
      const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw Error();chunks.push(chunk);}
      const headers=new Headers({'Cookie':'__Host-cc_workspace='+'a'.repeat(43)});
      if(req.headers['content-type'])headers.set('Content-Type',req.headers['content-type']);
      if(req.headers['x-cc-csrf'])headers.set('X-CC-CSRF',req.headers['x-cc-csrf']);
      if(req.headers.origin)headers.set('Origin',PROJECT_FIXTURE_ORIGIN);
      const response=await fixture.handle(new Request(PROJECT_FIXTURE_ORIGIN+url.pathname+url.search,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(req.method!=='GET'||url.search||!assets.has(url.pathname)){res.writeHead(404).end('Not found');return;}
    const file=resolve(root,'.'+url.pathname);if(await realpath(file)!==file)throw Error();
    res.writeHead(200,{'Content-Type':extname(file)==='.html'?'text/html':extname(file)==='.css'?'text/css':'text/javascript','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(await readFile(file));
  }catch{res.writeHead(500,{'Cache-Control':'no-store'}).end('Fictional preview unavailable.');}});
  return{server,async close(){await new Promise(resolve=>server.close(resolve));await fixture.close();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const mode=validateProjectPreviewArguments(process.argv.slice(2));if(!mode)console.log('PLAN ONLY: --fixtures-only starts a disposable SQL-backed project/task preview on an ephemeral loopback port. No saved personal records or credentials are opened.');
  else{const app=await makeProjectWorkspaceFixturePreview();serverExit(app);app.server.listen(0,'127.0.0.1',()=>console.log('Fictional projects preview: http://127.0.0.1:'+app.server.address().port+'/project-workspace.html'));}}
  catch{console.error('Fictional projects preview stopped. No private configuration was loaded.');process.exitCode=1;}
}
function serverExit(app){let closing=false;for(const event of ['SIGINT','SIGTERM'])process.on(event,async()=>{if(closing)return;closing=true;await app.close();});}
