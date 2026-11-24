// Calendar display only. This preference never changes event access or content.
export function defaultCalendarPresentation(){return{schemaVersion:1,monthDisplay:'details'};}
export function validateCalendarPresentation(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='monthDisplay,schemaVersion'||value.schemaVersion!==1||!['dots','details'].includes(value.monthDisplay))throw Error('Supported Calendar presentation required.');
 return{schemaVersion:1,monthDisplay:value.monthDisplay};
}
