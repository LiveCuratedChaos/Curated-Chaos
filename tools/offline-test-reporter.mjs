// Keep test names, paths, messages and stack traces out of the offline report.
import {createHash} from 'node:crypto';
import {basename} from 'node:path';

export function offlineSuiteId(file){
 if(typeof file!=='string')return null;
 const name=basename(file);
 if(!/^[a-zA-Z0-9_.-]+\.test\.mjs$/.test(name))return null;
 return createHash('sha256').update(name).digest('hex').slice(0,16);
}

function deniedLocalListener(error){
 return error?.syscall==='listen'&&['EPERM','EACCES'].includes(error.code)&&['127.0.0.1','::1'].includes(error.address);
}
export default async function* offlineTestReporter(events){
 let loopbackListenerDenied=0,assertionWithDeniedListener=0;
 const unclassifiedSites=new Set();
 for await(const {type,data} of events){
  if(type==='test:fail'){
   const error=data.details?.error;
   const cause=error?.code==='ERR_TEST_FAILURE'?error.cause:error;
   const actual=cause?.actual;
   if(deniedLocalListener(cause))loopbackListenerDenied++;
   else if(cause?.code==='ERR_ASSERTION'&&(deniedLocalListener(actual)||/^listen (?:EPERM: operation not permitted|EACCES: permission denied) (?:127\.0\.0\.1|::1)(?::\d{1,5})?$/.test(actual?.message??'')))assertionWithDeniedListener++;
   else if(unclassifiedSites.size<16&&Number.isSafeInteger(data.line)&&data.line>0){
    const suite=offlineSuiteId(data.file);
    if(suite)unclassifiedSites.add(suite+':'+data.line);
   }
  }
  if(type==='test:diagnostic'&&!data.file&&data.nesting===0&&/^(?:tests|pass|fail|cancelled|skipped) \d+$/.test(data.message)){
   yield '# '+data.message+'\n';
  }
 }
 for(const site of unclassifiedSites)yield '# unclassifiedSite '+site+'\n';
 yield '# loopbackListenerDenied '+loopbackListenerDenied+'\n';
 yield '# assertionWithDeniedListener '+assertionWithDeniedListener+'\n';
}
