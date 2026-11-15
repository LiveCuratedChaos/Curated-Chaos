// Explicit read-only preview. Source data is returned to the signed-in owner, never persisted here.
import {readGmailWindow,GMAIL_READ_SCOPE} from './gmail.mjs';
import {readGoogleCalendarWindow,GOOGLE_CALENDAR_READ_SCOPE} from './google-calendar.mjs';
export function createGoogleSourcePreview({connectionStore,refreshAccessToken,confirmSession,fetcher=fetch}){
 return async({ownerId,binding,connectionId,selectionId,confirmed})=>{
  if(confirmed!==true||!await confirmSession(ownerId,binding))throw Error('Explicit preview approval and a verified session are required.');
  const row=await connectionStore.loadSelected(ownerId,connectionId,selectionId);
  const expected=row.provider==='gmail'?GMAIL_READ_SCOPE:row.provider==='google_calendar'?GOOGLE_CALENDAR_READ_SCOPE:null;
  if(!expected||row.scope!==expected)throw Error('Verified read permission required.');
  const accessToken=await refreshAccessToken(row.credentials.refreshToken);
  if(!await confirmSession(ownerId,binding))throw Error('App session ended.');
  await connectionStore.loadSelected(ownerId,connectionId,selectionId);
  const common={ownerId,connectionId,accessToken,timeMin:row.selection.timeMin,timeMax:row.selection.timeMax};
  const result=row.provider==='gmail'
   ?await readGmailWindow({...common,grant:{ownerId,connectionId,provider:'gmail',scopes:[expected],labelIds:row.selection.labelIds},selectedLabelIds:row.selection.labelIds},fetcher)
   :await readGoogleCalendarWindow({...common,calendarId:row.selection.calendarIds[0],authorizedCalendarIds:row.selection.calendarIds},fetcher);
  if(!await confirmSession(ownerId,binding))throw Error('App session ended before preview completed.');
  // Recheck the exact stored choice after the read; reject stale previews.
  await connectionStore.loadSelected(ownerId,connectionId,selectionId);
  return {previewOnly:true,persisted:false,selectionId,readAt:new Date().toISOString(),result};
 };
}
