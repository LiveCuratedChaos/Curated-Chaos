// A temporary tool sign-in must be closed on success and on every failed operation.
export async function withTemporaryDevelopmentSignIn(api,credentials,operation){
 if(!api||typeof api.signIn!=='function'||typeof api.signOutLocal!=='function'||typeof operation!=='function')throw Error('Temporary sign-in dependencies required.');
 const signed=await api.signIn(credentials.email,credentials.password);
 if(typeof signed?.accessToken!=='string'||!signed.accessToken)throw Error('Temporary sign-in could not be verified.');
 try{return await operation(signed);}finally{
  try{await api.signOutLocal(signed.accessToken);}catch{throw Error('Temporary sign-in cleanup could not be confirmed. Do not retry the operation until its result is reviewed.');}
 }
}
