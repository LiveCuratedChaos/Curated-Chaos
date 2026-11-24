const outcomes=Object.freeze({
 'reconnect-required':{status:409,message:'Provider authorization needs reconnection. No snapshot was accepted.'},
 'access-denied':{status:403,message:'Provider access was denied. Review the selected permission before reconnecting.'},
 'selection-changed':{status:409,message:'Changed selection. Load the current saved source before previewing.'},
 'session-ended':{status:401,message:'App session ended. Sign in again before previewing.'},
 'incomplete-read':{status:502,message:'The source read was incomplete or inconsistent. No partial snapshot was accepted.'},
 'source-unavailable':{status:503,message:'The provider source is unavailable. No snapshot was accepted; retry only after checking the connection.'}
});

export class ProviderReadError extends Error{
 constructor(outcome,message){const value=outcomes[outcome];if(!value)throw Error('Supported provider read outcome required.');super(typeof message==='string'?message:value.message);this.name='ProviderReadError';this.outcome=outcome;this.status=value.status;}
}

export function providerReadFailure(error){
 if(error instanceof ProviderReadError)return{status:error.status,outcome:error.outcome,error:error.message};
 return{status:502,outcome:'incomplete-read',error:outcomes['incomplete-read'].message};
}

export function providerRefreshFailure(error){
 const code=error?.code||error?.response?.data?.error||error?.response?.data?.error_description;
 if(['invalid_grant','invalid_token','unauthorized_client'].includes(code)||error?.response?.status===401)return new ProviderReadError('reconnect-required');
 if(error?.response?.status===403)return new ProviderReadError('access-denied');
 return new ProviderReadError('source-unavailable');
}
