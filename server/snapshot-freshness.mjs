// Save timestamps describe local app copies, never when a provider was last checked.
export function safeSavedAt(value){
 if(typeof value!=='string')return null;
 const match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
 if(!match||+match[2]>23||+match[3]>59||+match[4]>59||+(match[5]||0)>23||+(match[6]||0)>59)return null;
 const day=Date.parse(match[1]+'T00:00:00Z'),instant=Date.parse(value);
 if(!Number.isFinite(day)||new Date(day).toISOString().slice(0,10)!==match[1]||!Number.isFinite(instant))return null;
 return new Date(instant).toISOString();
}
export function snapshotFreshness({records,finance,now=Date.now()}){
 if(!Array.isArray(records)||!Array.isArray(finance?.accounts)||!Array.isArray(finance?.transactions)||!Number.isFinite(now))throw Error('Valid snapshot inventory and current time required.');
 const real=records.filter(row=>row.fictional===false),bank=[...finance.accounts,...finance.transactions].filter(row=>row.fictional===false);
 const sources=[['gmail',real.filter(row=>row.provider==='gmail')],['google_calendar',real.filter(row=>row.provider==='google_calendar')],['plaid',bank],['mac_calendar',real.filter(row=>row.provider==='mac_calendar')]].map(([provider,rows])=>{
  const times=rows.map(row=>safeSavedAt(row.savedAt)).filter(value=>value!==null&&Date.parse(value)<=now).sort();
  return{provider,count:rows.length,oldestSavedAt:times[0]||null,newestSavedAt:times.at(-1)||null,unknownSavedAtCount:rows.length-times.length,sourceCheckedAt:null};
 });return{asOf:new Date(now).toISOString(),sources};
}
