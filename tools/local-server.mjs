import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalConfig, assertDevTarget } from './dev-env.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
const port=Number(process.env.PORT||5173);
// Explicit allowlist. Never serve local credentials, migrations, tests, docs or unknown files.
const publicRoutes=new Set(['/','/index.html','/dev-auth.html','/dev-brief.html','/dev-dashboard.html','/dev-tasks.html','/dev-notes.html','/dev-agenda.html','/dev-email.html','/dev-life.html','/dev-settings.html','/dev-acceptance.html','/dev-workspace.html','/dev-organize.html','/dev-calendar.html','/dev-school.html','/dev-work.html','/dev-personal.html','/dev-home.html','/dev-finances.html','/dev-search.html','/dev-account.html','/dev-integration.html','/dev-config.json','/src/app.mjs','/src/core.mjs','/src/dev-api.mjs','/src/dev-auth.mjs','/src/dev-brief.mjs','/src/dev-brief-model.mjs','/src/dev-intelligence-model.mjs','/src/dev-decision-model.mjs','/src/dev-settings.mjs','/src/dev-preferences-model.mjs','/src/dev-agenda.mjs','/src/dev-agenda-model.mjs','/src/dev-email.mjs','/src/dev-email-model.mjs','/src/dev-life.mjs','/src/dev-life-model.mjs','/src/dev-sync-model.mjs','/src/dev-acceptance.mjs','/src/dev-acceptance-model.mjs','/src/dev-session.mjs','/src/dev-cloud-shell.mjs','/src/dev-navigation-model.mjs','/src/dev-workspace-model.mjs','/src/dev-widget-layout-model.mjs','/src/dev-workspace.mjs','/src/dev-organize.mjs','/src/dev-organize-model.mjs','/src/dev-calendar.mjs','/src/dev-calendar-model.mjs','/src/dev-school.mjs','/src/dev-school-model.mjs','/src/dev-work.mjs','/src/dev-work-model.mjs','/src/dev-personal.mjs','/src/dev-personal-model.mjs','/src/dev-home.mjs','/src/dev-home-model.mjs','/src/dev-finances.mjs','/src/dev-finances-model.mjs','/src/dev-search.mjs','/src/dev-account.mjs','/src/dev-integration.mjs','/src/dev-integration-model.mjs','/src/dev-search-model.mjs','/src/dev-theme.mjs','/src/dev-tasks.mjs','/src/dev-tasks-model.mjs','/src/dev-notes.mjs','/src/styles.css','/public/manifest.webmanifest','/public/icons/icon-192.png','/public/icons/icon-512.png']);
export function allowedPublicPath(path){ return typeof path==='string' && publicRoutes.has(path); }
export function sanitizedDevConfig(raw){
  const dev=assertDevTarget(raw);
  return {supabaseUrl:dev.url, projectRef:dev.ref, publishableKey:dev.publishableKey,...(raw.CC_DEV_ATOMIC_FICTIONAL_APPROVALS==='enabled-after-approved-migration'?{atomicFictionalApprovals:true}:{})};
}
export function makeHandler(projectRoot=root){
  return async (req,res)=>{
    let pathname;
    try { pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname); }
    catch {res.writeHead(400).end('Bad request');return;}
    if(!allowedPublicPath(pathname) || (req.method!=='GET' && req.method!=='HEAD')) {res.writeHead(404).end('Not found');return;}
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'};
    let devOrigin='';
    if(pathname==='/dev-config.json' || (pathname==='/dev-auth.html' || pathname==='/dev-brief.html' || pathname==='/dev-dashboard.html' || pathname==='/dev-tasks.html' || pathname==='/dev-notes.html' || pathname==='/dev-agenda.html' || pathname==='/dev-email.html' || pathname==='/dev-life.html' || pathname==='/dev-settings.html' || pathname==='/dev-acceptance.html' || pathname==='/dev-workspace.html'||pathname==='/dev-organize.html'||pathname==='/dev-calendar.html'||pathname==='/dev-school.html'||pathname==='/dev-work.html'||pathname==='/dev-personal.html'||pathname==='/dev-home.html'||pathname==='/dev-finances.html'||pathname==='/dev-search.html'||pathname==='/dev-account.html'||pathname==='/dev-integration.html')){
      try {
        const config=sanitizedDevConfig(loadLocalConfig(resolve(projectRoot,'.env.local')));
        devOrigin=config.supabaseUrl;
        if(pathname==='/dev-config.json'){
          res.writeHead(200,{...headers,'Content-Type':'application/json; charset=utf-8','Content-Security-Policy':"default-src 'none'"});
          res.end(req.method==='HEAD'?'':JSON.stringify(config));return;
        }
      }catch{
        res.writeHead(503,{...headers,'Content-Type':'text/plain; charset=utf-8'}).end('Development configuration unavailable or failed safety check. Check .env.local.');return;
      }
    }
    const file=resolve(projectRoot, '.'+(pathname==='/'?'/index.html':pathname));
    if(file!==projectRoot && !file.startsWith(projectRoot+sep)){res.writeHead(404).end('Not found');return;}
    try {
      const actualRoot=await realpath(projectRoot),actualFile=await realpath(file);
      const expectedFile=resolve(actualRoot,'.'+(pathname==='/'?'/index.html':pathname));
      if(actualFile!==expectedFile)throw Error('Linked public files are not served');
      if(!(await stat(file)).isFile()) throw Error('not a file');
      const body=await readFile(file);
      const connect=(pathname==='/dev-auth.html' || pathname==='/dev-brief.html' || pathname==='/dev-dashboard.html' || pathname==='/dev-tasks.html' || pathname==='/dev-notes.html' || pathname==='/dev-agenda.html' || pathname==='/dev-email.html' || pathname==='/dev-life.html' || pathname==='/dev-settings.html' || pathname==='/dev-acceptance.html' || pathname==='/dev-workspace.html'||pathname==='/dev-organize.html'||pathname==='/dev-calendar.html'||pathname==='/dev-school.html'||pathname==='/dev-work.html'||pathname==='/dev-personal.html'||pathname==='/dev-home.html'||pathname==='/dev-finances.html'||pathname==='/dev-search.html'||pathname==='/dev-account.html'||pathname==='/dev-integration.html')?`'self' ${devOrigin}`:"'self'";
      res.writeHead(200,{...headers,'Content-Type':types[extname(file)]||'application/octet-stream','Content-Security-Policy':`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src ${connect}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`});
      res.end(req.method==='HEAD'?'':body);
    }catch {res.writeHead(404).end('Not found');}
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createServer(makeHandler()).listen(port,'127.0.0.1',()=>{
    console.log(`\nCurated Chaos — DEVELOPMENT ONLY (M3D Phase 2)\nFictional dashboard: http://localhost:${port}\nIsolated Supabase login test: http://localhost:${port}/dev-auth.html\nConnected Daily Brief in app layout: http://localhost:${port}/dev-dashboard.html\nSimple Daily Brief QA: http://localhost:${port}/dev-brief.html\nConnected Tasks QA: http://localhost:${port}/dev-tasks.html\nConnected Notes QA: http://localhost:${port}/dev-notes.html\nConnected seven-day agenda QA: http://localhost:${port}/dev-agenda.html\nFictional email insights QA: http://localhost:${port}/dev-email.html\nFictional school, finance and household QA: http://localhost:${port}/dev-life.html\nPrivate Daily Brief Settings QA: http://localhost:${port}/dev-settings.html\nEnd-to-end acceptance checklist: http://localhost:${port}/dev-acceptance.html\nWorkspace navigation: http://localhost:${port}/dev-workspace.html?page=curation\nQuick Add, Tasks and Projects: http://localhost:${port}/dev-organize.html\nCalendar month/week/day: http://localhost:${port}/dev-calendar.html\nSchool course & assessment tracker: http://localhost:${port}/dev-school.html\nWork & Career workspace: http://localhost:${port}/dev-work.html\nPersonal Life workspace: http://localhost:${port}/dev-personal.html\nHome & Household workspace: http://localhost:${port}/dev-home.html\nFinances fictional workspace: http://localhost:${port}/dev-finances.html\nPrivate universal search: http://localhost:${port}/dev-search.html\nMy Account preferences: http://localhost:${port}/dev-account.html\nIntegration acceptance: http://localhost:${port}/dev-integration.html\nUses ONLY locally configured new development project.\nPress Ctrl+C to stop.\n`);
  });
}
