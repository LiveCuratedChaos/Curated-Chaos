// Explicit read-only preview. Source data is returned to the signed-in owner, never persisted here.
import {readGmailWindow,GMAIL_READ_SCOPE} from './gmail.mjs';
import {readGoogleCalendarWindow,GOOGLE_CALENDAR_READ_SCOPE} from './google-calendar.mjs';
import {ProviderReadError,providerRefreshFailure} from './provider-read-error.mjs';
export function createGoogleSourcePreview({connectionStore,refreshAccessToken,confirmSession,fetcher=fetch}){
 return async({ownerId,binding,connectionId,selectionId,confirmed})=>{
  if(confirmed!==true)throw new ProviderReadError('session-ended','Explicit preview approval and a verified session are required.');
  if(!await confirmSession(ownerId,binding))throw new ProviderReadError('session-ended');
  let row;try{row=await connectionStore.loadSelected(ownerId,connectionId,selectionId);}catch(error){throw new ProviderReadError(/(?:selection changed|changed selection)/i.test(error?.message||'')?'selection-changed':'source-unavailable');}
  const expected=row.provider==='gmail'?GMAIL_READ_SCOPE:row.provider==='google_calendar'?GOOGLE_CALENDAR_READ_SCOPE:null;
  if(!expected||row.scope!==expected)throw new ProviderReadError('access-denied','Verified read permission required.');
  let accessToken;try{accessToken=await refreshAccessToken(row.credentials.refreshToken);}catch(error){throw providerRefreshFailure(error);}
  if(!await confirmSession(ownerId,binding))throw new ProviderReadError('session-ended');
  try{await connectionStore.loadSelected(ownerId,connectionId,selectionId);}catch(error){throw new ProviderReadError(/(?:selection changed|changed selection)/i.test(error?.message||'')?'selection-changed':'source-unavailable');}
  const common={ownerId,connectionId,accessToken,timeMin:row.selection.timeMin,timeMax:row.selection.timeMax};
  const result=row.provider==='gmail'
   ?await readGmailWindow({...common,grant:{ownerId,connectionId,provider:'gmail',scopes:[expected],labelIds:row.selection.labelIds},selectedLabelIds:row.selection.labelIds},fetcher)
   :await readGoogleCalendarWindow({...common,calendarId:row.selection.calendarIds[0],authorizedCalendarIds:row.selection.calendarIds},fetcher);
  if(!await confirmSession(ownerId,binding))throw new ProviderReadError('session-ended','App session ended before preview completed.');
  // Recheck the exact stored choice after the read; reject stale previews.
  try{await connectionStore.loadSelected(ownerId,connectionId,selectionId);}catch(error){throw new ProviderReadError(/(?:selection changed|changed selection)/i.test(error?.message||'')?'selection-changed':'source-unavailable');}
  return {previewOnly:true,persisted:false,selectionId,readAt:new Date().toISOString(),result};
 };
}
