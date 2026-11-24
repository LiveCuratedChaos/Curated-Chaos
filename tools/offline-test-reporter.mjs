// Keep test names, paths, messages and stack traces out of the offline report.
function deniedLocalListener(error){
 return error?.syscall==='listen'&&['EPERM','EACCES'].includes(error.code)&&['127.0.0.1','::1'].includes(error.address);
}
export default async function* offlineTestReporter(events){
 let loopbackListenerDenied=0,assertionWithDeniedListener=0;
 for await(const {type,data} of events){
  if(type==='test:fail'){
   const error=data.details?.error;
   const cause=error?.code==='ERR_TEST_FAILURE'?error.cause:error;
   if(deniedLocalListener(cause))loopbackListenerDenied++;
   else if(cause?.code==='ERR_ASSERTION'){
    // Node can serialize an assertion's actual Error with only its message and stack.
    const actual=cause.actual;
    if(deniedLocalListener(actual)||/^listen (?:EPERM: operation not permitted|EACCES: permission denied) (?:127\.0\.0\.1|::1)(?::\d{1,5})?$/.test(actual?.message??''))assertionWithDeniedListener++;
   }
  }
  if(type==='test:diagnostic'&&!data.file&&data.nesting===0&&/^(?:tests|pass|fail|cancelled|skipped) \d+$/.test(data.message)){
   yield '# '+data.message+'\n';
  }
 }
 yield '# loopbackListenerDenied '+loopbackListenerDenied+'\n';
 yield '# assertionWithDeniedListener '+assertionWithDeniedListener+'\n';
}
