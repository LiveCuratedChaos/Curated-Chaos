// Local source preferences only. Saving a selection never authorizes or starts an import.
export function validateGoogleSourceSelection(provider,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a source and date window.');
 const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose valid dates.');const t=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==value)throw Error('Choose valid dates.');return t;};
 const start=date(input.startDate),end=date(input.endDate),days=(end-start)/86400000;
 if(days<=0||days>(provider==='gmail'?31:366))throw Error('Choose a bounded date window.');
 const window={timeMin:new Date(start).toISOString(),timeMax:new Date(end).toISOString()};
 if(provider==='gmail'){
  // Initial release supports one known label; custom labels require separate discovery UI.
  if(input.source!=='INBOX')throw Error('Select Inbox explicitly.');
  return {provider,...window,labelIds:['INBOX'],content:'metadata-only',importApproved:false};
 }
 if(provider==='google_calendar'){
  if(input.source!=='primary')throw Error('Select the primary calendar explicitly.');
  return {provider,...window,calendarIds:['primary'],importApproved:false};
 }
 throw Error('Unsupported provider.');
}
