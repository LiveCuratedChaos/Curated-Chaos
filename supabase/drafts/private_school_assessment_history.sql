-- PREPARED ONLY. Install in isolated fictional infrastructure after review. No data rewrite.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
do $$begin if to_regprocedure('public.cc_private_school_recovery_ready()') is null or not exists(select 1 from pg_proc where oid=to_regprocedure('cc_private.school_recovery_guard()') and md5(prosrc)='dda72fea77e67d9c37f6fe229cdd3bf1') then raise exception 'Reviewed School recovery prerequisite required';end if;end$$;
create function cc_private.school_assessment_nodes(p jsonb) returns setof jsonb language sql immutable set search_path='' as $$
select value from jsonb_array_elements(coalesce(p->'assessments','[]'::jsonb)) union all select value->'record' from jsonb_array_elements(coalesce(p->'removedAcademicRecords','[]'::jsonb)) where value->>'kind'='assessment'
$$;
create function cc_private.school_assessment_history_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb;h jsonb;v jsonb;ids text[]:='{}';pairs text[];prior_attempts text[];k text;stamp timestamptz;
begin
 for a in select * from cc_private.school_assessment_nodes(p) loop
 if a?'learningRecord' then
 if p->'academicIdentityVersion' is distinct from '1'::jsonb or not cc_private.school_uuid(a->>'academicId') then return false;end if;
 h:=a->'learningRecord';if jsonb_typeof(h) is distinct from 'object' or (select count(*) from jsonb_object_keys(h))<>3 or h->'version' is distinct from '1'::jsonb or jsonb_typeof(h->'attempts') is distinct from 'array' or jsonb_typeof(h->'rubricVersions') is distinct from 'array' or jsonb_array_length(h->'attempts')>20 or jsonb_array_length(h->'rubricVersions')>20 then return false;end if;
 pairs:='{}';prior_attempts:='{}';for v in select value from jsonb_array_elements(h->'attempts') loop
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>(case when v?'clarifiesAttemptId' then 7 else 6 end) or not cc_private.school_uuid(v->>'id') or not cc_private.school_text(v->'label',120,true) or not cc_private.school_day(v->'day') or not cc_private.school_text(v->'result',120) or not cc_private.school_text(v->'notes',2000) then return false;end if;
 if v?'clarifiesAttemptId' and (not cc_private.school_uuid(v->>'clarifiesAttemptId') or not(lower(v->>'clarifiesAttemptId')=any(prior_attempts))) then return false;end if;k:=jsonb_build_array(v->'label',v->'day',v->'result',v->'notes',v->'clarifiesAttemptId')::text;if k=any(pairs) then return false;end if;pairs:=array_append(pairs,k);
 if translate((v->>'label')||(v->>'result')||(v->>'notes'),chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' then return false;end if;stamp:=cc_private.school_recovery_time(v->'recordedAt');if v->>'recordedAt' !~ '^20' or stamp is null or lower(v->>'id')=any(ids) then return false;end if;ids:=array_append(ids,lower(v->>'id'));prior_attempts:=array_append(prior_attempts,lower(v->>'id'));
 end loop;
 for v in select value from jsonb_array_elements(h->'rubricVersions') loop
 if translate(v->>'text',chr(9)||chr(10)||chr(13),'') ~ '[[:cntrl:]]' or v->>'recordedAt' !~ '^20' then return false;end if;
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>3 or not cc_private.school_uuid(v->>'id') or not cc_private.school_text(v->'text',12000) or cc_private.school_recovery_time(v->'recordedAt') is null or lower(v->>'id')=any(ids) then return false;end if;ids:=array_append(ids,lower(v->>'id'));
 end loop;
 end if;end loop;
 foreach k in array cc_private.school_recovery_active_ids(p) loop if lower(k)=any(ids) then return false;end if;end loop;
 for a in select value from jsonb_array_elements(coalesce(p->'removedAcademicRecords','[]'::jsonb)) loop if lower(a->>'recoveryId')=any(ids) or lower(a->'record'->>'academicId')=any(ids) then return false;end if;if a->>'kind'='assessment' then for v in select value from jsonb_array_elements(a->'record'->'tasks') loop if lower(v->>'academicId')=any(ids) then return false;end if;end loop;end if;end loop;
 return octet_length(p::text)<=524288;
exception when others then return false;end$$;
create function cc_private.school_assessment_history_guard() returns trigger language plpgsql set search_path='' as $$
declare a jsonb;b jsonb;h jsonb;prior jsonb;v jsonb;name text;n integer;old_course boolean:=false;new_course boolean;
begin
 new_course:=new.visibility='private' and new.household_id is null and new.section='School' and new.item_type='school_fixture' and new.origin='M2E_SCHOOL_QA' and new.payload->>'kind'='course';
 if tg_op='UPDATE' then old_course:=old.visibility='private' and old.household_id is null and old.section='School' and old.item_type='school_fixture' and old.origin='M2E_SCHOOL_QA' and old.payload->>'kind'='course';end if;
 if old_course and not new_course and exists(select 1 from cc_private.school_assessment_nodes(old.payload) x where x?'learningRecord') then raise exception 'Assessment history scope must be preserved';end if;
 if not new_course then return new;end if;
 if not cc_private.school_assessment_history_valid(new.payload) then raise exception 'Verified assessment history required';end if;
 for b in select * from cc_private.school_assessment_nodes(new.payload) loop
 h:=b->'learningRecord';if h is null then continue;end if;prior:=null;
 if old_course then select x->'learningRecord' into prior from cc_private.school_assessment_nodes(old.payload) x where lower(x->>'academicId')=lower(b->>'academicId');end if;
 foreach name in array array['rubricVersions','attempts'] loop
 n:=jsonb_array_length(coalesce(prior->name,'[]'::jsonb));if jsonb_array_length(h->name)<n or (old_course and name='rubricVersions' and jsonb_array_length(h->name)>n+1) then raise exception 'Assessment history is append only';end if;
 for i in 0..n-1 loop if (h->name)->i is distinct from (prior->name)->i then raise exception 'Existing assessment history is immutable';end if;end loop;
 for v in select value from jsonb_array_elements(h->name) with ordinality e(value,pos) where pos>n loop if old_course and (cc_private.school_recovery_time(v->'recordedAt')>statement_timestamp() or cc_private.school_recovery_time(v->'recordedAt')<statement_timestamp()-interval '5 minutes') then raise exception 'Fresh reviewed assessment history required';end if;end loop;
 end loop;end loop;
 if old_course then for a in select * from cc_private.school_assessment_nodes(old.payload) loop
 if a?'learningRecord' and not exists(select 1 from cc_private.school_assessment_nodes(new.payload) x where lower(x->>'academicId')=lower(a->>'academicId') and x?'learningRecord') then raise exception 'Original-parent assessment history cannot be discarded';end if;
 end loop;end if;return new;end$$;
create trigger cc_school_assessment_history_guard before insert or update on public.cc_records for each row execute function cc_private.school_assessment_history_guard();
revoke all on function cc_private.school_assessment_nodes(jsonb),cc_private.school_assessment_history_valid(jsonb),cc_private.school_assessment_history_guard() from public,anon,authenticated;
grant execute on function cc_private.school_assessment_nodes(jsonb),cc_private.school_assessment_history_valid(jsonb) to authenticated;
-- Schema proof and the source write share one transaction and table lock.
create function public.update_private_school_assessment_history(p_record_id uuid,p_version integer,p_payload jsonb) returns setof public.cc_records language plpgsql set search_path='' as $$
declare who uuid:=auth.uid();r public.cc_records;a jsonb;b jsonb;t jsonb;u jsonb;i integer;j integer;
begin
 lock table public.cc_records in row exclusive mode;
 if who is null or not cc_private.development_session_active() or public.cc_private_school_assessment_history_ready() is distinct from true then raise exception 'Current owned assessment history protections required';end if;
 perform cc_private.school_lock(who);
 select * into r from public.cc_records where id=p_record_id and owner_id=who and visibility='private' and household_id is null and section='School' and item_type='school_fixture' and origin='M2E_SCHOOL_QA' and deleted_at is null for update;
 if not found or r.version is distinct from p_version or p_payload->'academicIdentityVersion' is distinct from '1'::jsonb or (r.payload-'assessments') is distinct from (p_payload-'assessments') or jsonb_typeof(p_payload->'assessments') is distinct from 'array' or jsonb_array_length(r.payload->'assessments')<>jsonb_array_length(p_payload->'assessments') then raise exception 'Reviewed original course revision required';end if;
 for i in 0..jsonb_array_length(r.payload->'assessments')-1 loop
 a:=(r.payload->'assessments')->i;b:=(p_payload->'assessments')->i;
 if (a-array['title','type','status','tasks','learningRecord']) is distinct from (b-array['title','type','status','tasks','learningRecord']) or jsonb_typeof(b->'tasks') is distinct from 'array' or jsonb_array_length(a->'tasks')<>jsonb_array_length(b->'tasks') then raise exception 'Assessment identity and topology must be preserved';end if;
 for j in 0..jsonb_array_length(a->'tasks')-1 loop t:=(a->'tasks')->j;u:=(b->'tasks')->j;if (t-array['title','done']) is distinct from (u-array['title','done']) then raise exception 'Original step identity must be preserved';end if;end loop;
 end loop;
 return query update public.cc_records set payload=p_payload where id=r.id and owner_id=who and version=p_version returning *;
end$$;
revoke all on function public.update_private_school_assessment_history(uuid,integer,jsonb) from public,anon;
grant execute on function public.update_private_school_assessment_history(uuid,integer,jsonb) to authenticated;
-- Capture newly created reviewed bodies, then detect later drift rather than trusting names.
do $install$declare expected text;begin
 select string_agg(format('(%L,%L)',format('%I.%I(%s)',n.nspname,p.proname,pg_catalog.oidvectortypes(p.proargtypes)),md5(p.prosrc)),',') into expected from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in ('cc_private.school_assessment_nodes(jsonb)'::regprocedure,'cc_private.school_assessment_history_valid(jsonb)'::regprocedure,'cc_private.school_assessment_history_guard()'::regprocedure,'public.update_private_school_assessment_history(uuid,integer,jsonb)'::regprocedure);
 execute format($ready$create function public.cc_private_school_assessment_history_ready() returns boolean language sql stable set search_path='' as $body$select coalesce(public.cc_private_school_recovery_ready(),false) and not exists(select 1 from(values %s) e(signature,hash) left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or md5(p.prosrc)<>e.hash or p.prosecdef or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from (p.proname<>'school_assessment_history_guard') or p.provolatile is distinct from (case when p.proname in ('school_assessment_history_guard','update_private_school_assessment_history') then 'v'::"char" else 'i'::"char" end) or p.proconfig is distinct from array['search_path=""']::text[]) and exists(select 1 from pg_trigger where tgrelid='public.cc_records'::regclass and tgname='cc_school_assessment_history_guard' and tgfoid='cc_private.school_assessment_history_guard()'::regprocedure and tgenabled='O' and tgtype=23 and not tgisinternal and tgqual is null and tgattr=''::int2vector and tgnargs=0) $body$ $ready$,expected);
end$install$;
revoke all on function public.cc_private_school_assessment_history_ready() from public,anon;
grant execute on function public.cc_private_school_assessment_history_ready() to authenticated;
commit;
