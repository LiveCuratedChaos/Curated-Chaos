// M1C — explicit fictional email examples, NOT a mail API or auto-import.
// Never accept or display real inbox content in this development test.
import { addDays, dayString } from './core.mjs';
import { validDay } from './dev-brief-model.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EMAIL_EXAMPLES=Object.freeze([
  Object.freeze({id:'appointment',sender:'Appointments <appointments@example.invalid>',subject:'Sample: appointment confirmation needed',preview:'Example-only message: please confirm your fictional appointment.',category:'Appointment',actionTitle:'Confirm sample appointment',section:'Personal Life',offset:1}),
  Object.freeze({id:'study',sender:'Learning Desk <learning@example.invalid>',subject:'Sample: assessment preparation reminder',preview:'Example-only message: review the fictional assessment checklist.',category:'School',actionTitle:'Review sample assessment checklist',section:'School',offset:2}),
  Object.freeze({id:'receipt',sender:'Sample Shop <orders@example.invalid>',subject:'Sample: order receipt',preview:'Example-only purchase receipt; no task is suggested and no real amount or purchase is included.',category:'Receipt',actionTitle:null,section:null,offset:0})
]);
export function makeFictionalEmail(templateId,ownerId,today=dayString()){
  const template=EMAIL_EXAMPLES.find(x=>x.id===templateId);
  if(!template)throw Error('Choose an available fictional email template.');
  if(!UUID.test(ownerId||''))throw Error('Verified development account required.');
  if(!validDay(today))throw Error('Invalid example date.');
  return {owner_id:ownerId,household_id:null,visibility:'private',section:'Personal Life',item_type:'email_fixture',origin:'M1C_EMAIL_QA',payload:{fictional:true,source:'M1C_EMAIL_QA',template_id:template.id,received_day:today,action_day:addDays(today,template.offset),subject:template.subject,sender:template.sender,preview:template.preview}};
}
export function normalizeFictionalEmails(raw,ownerId){
  if(!UUID.test(ownerId||'')||!Array.isArray(raw))return [];
  const valid=raw.filter(row=>{
    const p=row?.payload;
    const template=EMAIL_EXAMPLES.find(t=>t.id===p?.template_id);
    return UUID.test(row.id||'')&&row.owner_id===ownerId&&row.household_id===null&&row.visibility==='private'&&row.item_type==='email_fixture'&&row.section==='Personal Life'&&template&&p?.fictional===true&&p?.source==='M1C_EMAIL_QA'&&p.subject===template.subject&&p.sender===template.sender&&p.preview===template.preview&&validDay(p.received_day)&&validDay(p.action_day)&&p.action_day===addDays(p.received_day,template.offset);
  });
  // Deduplicate identical sample templates for the viewer, even after a double-click or multi-tab add.
  const seen=new Set();
  return valid.sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||a.id.localeCompare(b.id)).filter(row=>{
    const key=row.payload.template_id;
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
export function emailSuggestions(emails){
  return (Array.isArray(emails)?emails:[]).flatMap(row=>{
    const p=row?.payload;
    const template=EMAIL_EXAMPLES.find(t=>t.id===p?.template_id);
    if(!template?.actionTitle||!UUID.test(row?.id||'')||!validDay(p.action_day))return [];
    return [{id:`email-fixture-${row.id}`,source:'email',rule:'email_to_task',section:template.section,day:p.action_day,title:template.actionTitle,reason:`The fictional email “${template.subject}” suggests a task. You can review and change it before saving.`,emailId:row.id}];
  });
}
export function isEmailFixtureSuggestion(s){return Boolean(s&&s.source==='email'&&s.rule==='email_to_task'&&/^email-fixture-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.id||''));}
