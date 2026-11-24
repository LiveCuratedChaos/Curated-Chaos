import {makePrivateSessionPreview} from '../../tools/private-session-preview-server.mjs';
import {createPrivateWorkspaceClient} from '../../src/private-workspace-client.mjs';

export function privateWorkspaceFixture(t,options={}){
 const app=makePrivateSessionPreview({fixtures:true,serveWorkspace:true,allowBriefRead:true,...options});
 t.after(()=>app.dispose());
 const handler=app.server.listeners('request')[0];
 const host='127.0.0.1:'+(options.previewPort??5312);
 function tab(){
  let cookie='',lastStatus=0;
  async function fetcher(path,options={}){
   const headers=Object.fromEntries(Object.entries(options.headers??{}).map(([k,v])=>[k.toLowerCase(),v]));
   const req={url:path,method:options.method??'GET',headers:{host,origin:'http://'+host,cookie,...headers},
    async *[Symbol.asyncIterator](){yield options.body??'';}};
   let content='';
   const res={writeHead(status,fields){lastStatus=status;if(fields['Set-Cookie'])cookie=fields['Set-Cookie'].split(';')[0];return this;},end(text){content=text;}};
   await handler(req,res);
   return {ok:lastStatus===200,status:lastStatus,json:()=>JSON.parse(content)};
  }
  const client=createPrivateWorkspaceClient(fetcher);
  return {fetcher,client,login:()=>client.signIn('demo@example.test','fictional-only')};
 }
 return {tab};
}
