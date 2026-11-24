// Generate a rollback-only hosted policy check. Caller identities are verified separately.
import {randomUUID} from 'node:crypto';
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function householdPolicyCheck({ownerA,ownerB,sessionA,sessionB,runId=randomUUID()}){
 if(!uuid(ownerA)||!uuid(ownerB)||ownerA===ownerB||!uuid(sessionA)||!uuid(sessionB)||sessionA===sessionB||!uuid(runId))throw Error('Two distinct verified development sessions and a QA run required.');
 const homeA=randomUUID(),homeB=randomUUID(),ids=Array.from({length:6},()=>randomUUID());
 const claims=(id,session)=>`select set_config('request.jwt.claim.sub','${id}',true);\nselect set_config('request.jwt.claims',jsonb_build_object('sub','${id}','session_id','${session}','role','authenticated')::text,true);\nset local role authenticated;`;
 const rows=[[ids[0],ownerA,null,'private','Home','private-a'],[ids[1],ownerB,null,'private','Home','private-b'],[ids[2],ownerA,homeA,'household','Home','shared-home'],[ids[3],ownerA,homeA,'household','School','shared-school'],[ids[4],ownerA,homeA,'household','Finances','shared-finance'],[ids[5],ownerB,homeB,'household','Home','other-household']];
 const sql=`-- ROLLBACK-ONLY DEVELOPMENT POLICY CHECK. Owner approval required before running.
-- Expected project: fngauurauwvbawlfzbbe. No providers, real household invites or existing-row changes.
begin;
insert into public.cc_households(id,owner_id,name) values
 ('${homeA}','${ownerA}','QA household ${runId} A'),('${homeB}','${ownerB}','QA household ${runId} B');
insert into public.cc_household_memberships(household_id,user_id,role,status,read_sections,write_sections)
 values('${homeA}','${ownerB}','adult','active',array['Home'],array['School']);
insert into public.cc_records(id,owner_id,household_id,visibility,section,item_type,origin,payload) values
${rows.map(([id,owner,home,visibility,section,label])=>` ('${id}','${owner}',${home?"'"+home+"'":'null'},'${visibility}','${section}','note','HOUSEHOLD_ROLLBACK_QA',jsonb_build_object('fictional',true,'fixtureRunId','${runId}','label','${label}'))`).join(',\n')};
${claims(ownerA,sessionA)}
do $$ begin
 if not public.cc_development_session_active() then raise exception 'Owner session expired';end if;
 if (select count(*) from public.cc_records where payload->>'fixtureRunId'='${runId}')<>4
 or exists(select 1 from public.cc_records where id in ('${ids[1]}','${ids[5]}')) then
  raise exception 'Owner private/tenant isolation failed'; end if;
end $$;
reset role;
${claims(ownerB,sessionB)}
do $$ declare changed integer; begin
 if not public.cc_development_session_active() then raise exception 'Member session expired';end if;
 if (select count(*) from public.cc_records where payload->>'fixtureRunId'='${runId}')<>4
 or exists(select 1 from public.cc_records where id in ('${ids[0]}','${ids[4]}')) then
  raise exception 'Member private/section isolation failed'; end if;
 update public.cc_records set payload=payload||'{"read_only_edit":true}'::jsonb where id='${ids[2]}';
 get diagnostics changed=row_count;if changed<>0 then raise exception 'Read-only section allowed edit';end if;
 update public.cc_records set payload=payload||'{"allowed_edit":true}'::jsonb where id='${ids[3]}';
 get diagnostics changed=row_count;if changed<>1 then raise exception 'Permitted section edit failed';end if;
 begin
  update public.cc_records set section='Finances' where id='${ids[3]}';
  raise exception using errcode='P9999',message='Unauthorized section move accepted';
 exception when insufficient_privilege then null;end;
 begin
  update public.cc_household_memberships set write_sections=array['Finances'] where household_id='${homeA}' and user_id='${ownerB}';
  raise exception using errcode='P9999',message='Membership escalation accepted';
 exception when insufficient_privilege then null;end;
 begin
  update public.cc_records set owner_id='${ownerA}' where id='${ids[1]}';
  raise exception using errcode='P9999',message='Private ownership transfer accepted';
 exception when sqlstate 'P0001' then null;end;
end $$;
reset role;
update public.cc_household_memberships set status='removed' where household_id='${homeA}' and user_id='${ownerB}';
${claims(ownerB,sessionB)}
do $$ begin
 if exists(select 1 from public.cc_records where household_id='${homeA}' and payload->>'fixtureRunId'='${runId}')
 or not exists(select 1 from public.cc_records where id='${ids[1]}') then
  raise exception 'Membership removal/private retention failed';end if;
end $$;
reset role;
-- All fictional changes, including the owner-membership trigger rows, are discarded.
rollback;
select 'passed' as policy_checks,
 not exists(select 1 from public.cc_households where id in ('${homeA}','${homeB}')) as no_qa_households_saved,
 not exists(select 1 from public.cc_household_memberships where household_id in ('${homeA}','${homeB}')) as no_qa_memberships_saved,
 not exists(select 1 from public.cc_records where payload->>'fixtureRunId'='${runId}') as no_qa_records_saved;
`;
 return {runId,sql,households:2,memberships:3,records:6,rolledBack:true};
}
