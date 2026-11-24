-- PREPARED ONLY: private prior-row snapshots. No hosted install or owner activation.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
lock table public.cc_records in share row exclusive mode nowait;
create table cc_private.record_versions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 record_id uuid not null,
 source_version integer not null check(source_version>0),
 item_type text not null check(item_type in('task','note','event','project','school_fixture','dashboard_layout','list_template','saved_search')),
 operation text not null check(operation in('UPDATE','DELETE')),
 captured_at timestamptz not null default statement_timestamp(),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 recovery jsonb default null check(recovery is null or jsonb_typeof(recovery)='object')
);
create index cc_record_versions_source on cc_private.record_versions(owner_id,record_id,captured_at desc,id desc);
alter table cc_private.record_versions enable row level security;
create policy cc_private_record_versions_read on cc_private.record_versions for select to authenticated using(
 owner_id=auth.uid() and cc_private.development_session_active() and exists(select 1 from public.cc_records r where r.id=record_id and r.owner_id=auth.uid() and r.visibility='private' and r.household_id is null and r.item_type=record_versions.item_type)
);
revoke all on cc_private.record_versions from public,anon,authenticated;
grant select on cc_private.record_versions to authenticated;
-- Version only an explicitly named shortcut. Search executions and returned records have no ledger source.
create function cc_private.named_search_version_source(snapshot jsonb)
returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb := snapshot->'payload'; f jsonb := p->'filters'; allowed text[];
begin
 if snapshot->>'item_type' is distinct from 'saved_search' or snapshot->>'section' is distinct from 'Personal Life'
    or snapshot->>'origin' is distinct from 'PRIVATE_COOKIE_SAVED_SEARCH' or jsonb_typeof(p) is distinct from 'object'
    or jsonb_typeof(f) is distinct from 'object' then return false; end if;
 if p-array['fictional','source','schemaVersion','title','filters'] <> '{}'::jsonb
    or p->'fictional' is distinct from 'true'::jsonb or p->'schemaVersion' is distinct from '1'::jsonb
    or p->>'source' is distinct from 'PRIVATE_SAVED_SEARCH_V1' or jsonb_typeof(p->'title') is distinct from 'string'
    or length(p->>'title') not between 1 and 80 or btrim(p->>'title') <> p->>'title'
    or p->>'title' ~ '[[:cntrl:]]' then return false; end if;
 case f->>'type'
  when 'document-text' then allowed := array['type','query'];
  when 'document-library' then allowed := array['type','query','collection'];
  else
   if not coalesce(f->>'type' in ('all','task','note','event','project','school','school-course','school-program'),false) then return false; end if;
   allowed := array['type','query','section','status','priority','dateFrom','dateTo','dateStatus'];
   if f ?| array['eventKind','eventSource','eventCategory'] then
    if f->>'type' <> 'event' then return false; end if;
    allowed := allowed || array['eventKind','eventSource','eventCategory'];
   end if;
 end case;
 return (f ?& allowed) and (f-allowed='{}'::jsonb) and not exists (
  select 1 from jsonb_each(f) x where jsonb_typeof(x.value)<>'string'
   or length(x.value#>>'{}')>150 or x.value#>>'{}' ~ '[[:cntrl:]]'
 );
end$$;
revoke all on function cc_private.named_search_version_source(jsonb) from public,anon;
grant execute on function cc_private.named_search_version_source(jsonb) to authenticated;
create function cc_private.capture_record_version() returns trigger language plpgsql security definer set search_path='' as $$
declare previous jsonb;
begin
 if old.visibility='private' and old.household_id is null and old.item_type in('task','note','event','project','school_fixture','dashboard_layout','list_template','saved_search') and (old.item_type<>'saved_search' or cc_private.named_search_version_source(to_jsonb(old))) then
 previous:=to_jsonb(old)||jsonb_build_object('created_at',to_char(old.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'updated_at',to_char(old.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'deleted_at',case when old.deleted_at is null then null else to_char(old.deleted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end);
 insert into cc_private.record_versions(owner_id,record_id,source_version,item_type,operation,snapshot) values(old.owner_id,old.id,old.version,old.item_type,tg_op,previous);
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
revoke all on function cc_private.capture_record_version() from public,anon,authenticated;
create trigger cc_capture_private_record_version before update or delete on public.cc_records for each row execute function cc_private.capture_record_version();
create function cc_private.immutable_record_version() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Stored prior record versions cannot be edited or deleted directly';end$$;
revoke all on function cc_private.immutable_record_version() from public,anon,authenticated;
create trigger cc_immutable_private_record_version before update or delete on cc_private.record_versions for each row execute function cc_private.immutable_record_version();
-- Security-invoker RPCs use the same source-dependent RLS as direct ledger reads.
create function public.list_private_record_versions(p_record_id uuid,p_offset integer default 0) returns jsonb language plpgsql set search_path='' as $$
declare total integer;versions jsonb;
begin
 if auth.uid() is null or not cc_private.development_session_active() or p_offset is null or p_offset<0 or p_offset>999950 or p_offset%50<>0 or not exists(select 1 from public.cc_records where id=p_record_id and owner_id=auth.uid() and visibility='private' and household_id is null and item_type in('task','note','event','project','school_fixture','dashboard_layout','list_template','saved_search')) then raise exception 'Current owned source required';end if;
 select count(*) into total from cc_private.record_versions where owner_id=auth.uid() and record_id=p_record_id;
 if total>1000000 or (p_offset>0 and p_offset>=total) then raise exception 'Bounded current history page required';end if;
 select coalesce(jsonb_agg(case when v.recovery is null then to_jsonb(v)-'recovery' else (to_jsonb(v)-'recovery')||jsonb_build_object('recovered',true,'recovered_at',v.recovery->>'restoredAt') end order by v.captured_at desc,v.id desc),'[]'::jsonb) into versions from(select id,source_version,item_type,operation,captured_at,recovery from cc_private.record_versions where owner_id=auth.uid() and record_id=p_record_id order by captured_at desc,id desc offset p_offset limit 50) v;
 return jsonb_build_object('versions',versions,'matchCount',total,'offset',p_offset,'limit',50);
end$$;
create function public.get_private_record_version(p_record_id uuid,p_version_id uuid) returns setof cc_private.record_versions language sql stable set search_path='' as $$select * from cc_private.record_versions where owner_id=auth.uid() and record_id=p_record_id and id=p_version_id and cc_private.development_session_active()$$;
revoke all on function public.list_private_record_versions(uuid,integer),public.get_private_record_version(uuid,uuid) from public,anon;
grant execute on function public.list_private_record_versions(uuid,integer),public.get_private_record_version(uuid,uuid) to authenticated;
-- Bounded authenticated export, used only by the explicit encrypted backup tool.
create function public.export_private_record_versions(p_after uuid default null) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if auth.uid() is null or not cc_private.development_session_active() then raise exception 'Active history owner required';end if;
 return(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]'::jsonb) from(select * from cc_private.record_versions where owner_id=auth.uid() and(p_after is null or id>p_after) order by id limit 100) v);
end$$;
revoke all on function public.export_private_record_versions(uuid) from public,anon;
grant execute on function public.export_private_record_versions(uuid) to authenticated;
-- Narrow recovery lock: no record/history writes and no standalone RPC locking.
create function public.lock_private_record_versions_for_recovery() returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not cc_private.development_session_active() or current_setting('role',true)<>'authenticated' or not exists(select 1 from pg_catalog.pg_locks where pid=pg_catalog.pg_backend_pid() and locktype='relation' and relation='public.cc_records'::regclass and granted and mode='ShareRowExclusiveLock') then return false;end if;
 lock table cc_private.record_versions in share mode nowait;
 return true;
end$$;
revoke all on function public.lock_private_record_versions_for_recovery() from public,anon;
grant execute on function public.lock_private_record_versions_for_recovery() to authenticated;
-- Recovered entries keep original facts and add forced destination provenance.
create function cc_private.record_version_recovery_valid(p jsonb,p_depth integer default 0) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if p_depth<0 or p_depth>20 or p is null then return false;end if;
 if p='null'::jsonb then return true;end if;
 if p_depth=20 or jsonb_typeof(p)<>'object' or (select count(*) from jsonb_object_keys(p))<>4 or not(p ?& array['version','snapshotId','restoredAt','previous']) or p->'version'<>'1'::jsonb or jsonb_typeof(p->'snapshotId')<>'string' or (p->>'snapshotId')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or jsonb_typeof(p->'restoredAt')<>'string' or (p->>'restoredAt')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then return false;end if;
 perform (p->>'restoredAt')::timestamptz;
 return cc_private.record_version_recovery_valid(p->'previous',p_depth+1);
exception when others then return false;
end$$;
revoke all on function cc_private.record_version_recovery_valid(jsonb,integer) from public,anon,authenticated;
create function public.import_private_record_versions(p_snapshot_id uuid,p_versions jsonb) returns setof cc_private.record_versions language plpgsql security definer set search_path='' as $$
declare entry jsonb;previous jsonb;snap jsonb;field text;imported cc_private.record_versions;provenance jsonb;
begin
 if auth.uid() is null or not cc_private.development_session_active() or current_setting('role',true)<>'authenticated' or p_snapshot_id is null or not public.lock_private_record_versions_for_recovery() or not public.cc_private_record_versions_ready() then raise exception 'Protected authenticated recovery transaction required';end if;
 if p_versions is null or jsonb_typeof(p_versions)<>'array' or jsonb_array_length(p_versions)>20000 or octet_length(p_versions::text)>5242880 then raise exception 'Complete bounded recovered history required';end if;
 for entry in select x.value from jsonb_array_elements(p_versions) x loop
  if jsonb_typeof(entry)<>'object' or not(entry ?& array['id','owner_id','record_id','source_version','item_type','operation','captured_at','snapshot']) or exists(select 1 from jsonb_object_keys(entry) k where k not in('id','owner_id','record_id','source_version','item_type','operation','captured_at','snapshot','recovery')) then raise exception 'Verified recovered history required';end if;
  if jsonb_typeof(entry->'id')<>'string' or (entry->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or jsonb_typeof(entry->'owner_id')<>'string' or (entry->>'owner_id')::uuid<>auth.uid() or jsonb_typeof(entry->'record_id')<>'string' or jsonb_typeof(entry->'source_version')<>'number' or (entry->>'source_version')!~'^[1-9][0-9]{0,9}$' or (entry->>'source_version')::bigint>2147483647 or jsonb_typeof(entry->'item_type')<>'string' or entry->>'item_type' not in('task','note','event','project','school_fixture','dashboard_layout','list_template','saved_search') or jsonb_typeof(entry->'operation')<>'string' or entry->>'operation' not in('UPDATE','DELETE') or jsonb_typeof(entry->'captured_at')<>'string' or (entry->>'captured_at')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Owned recovered history metadata required';end if;
  if not exists(select 1 from public.cc_records r where r.id=(entry->>'record_id')::uuid and r.owner_id=auth.uid() and r.household_id is null and r.visibility='private' and r.item_type=entry->>'item_type' and (r.item_type<>'saved_search' or cc_private.named_search_version_source(to_jsonb(r)))) or exists(select 1 from cc_private.record_versions where id=(entry->>'id')::uuid) then raise exception 'History conflicts with its current owned source';end if;
  snap:=entry->'snapshot';
  if jsonb_typeof(snap)<>'object' or (select count(*) from jsonb_object_keys(snap))<>12 or not(snap ?& array['id','owner_id','household_id','visibility','section','item_type','origin','payload','version','deleted_at','created_at','updated_at']) or (snap->>'id') is distinct from (entry->>'record_id') or (snap->>'owner_id') is distinct from (entry->>'owner_id') or (snap->'household_id') is distinct from 'null'::jsonb or (snap->>'visibility') is distinct from 'private' or (snap->>'item_type') is distinct from (entry->>'item_type') or (snap->'version') is distinct from (entry->'source_version') or jsonb_typeof(snap->'section')<>'string' or snap->>'section' not in('Home','Calendar','Personal Life','Work','School','Finances') or jsonb_typeof(snap->'origin')<>'string' or char_length(snap->>'origin') not between 1 and 500 or jsonb_typeof(snap->'payload')<>'object' or octet_length((snap->'payload')::text)>1048576 then raise exception 'Exact complete private history snapshot required';end if;
  foreach field in array array['created_at','updated_at','deleted_at'] loop
   if field='deleted_at' and snap->field='null'::jsonb then continue;end if;
   if jsonb_typeof(snap->field)<>'string' or snap->>field!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,6})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then raise exception 'Exact snapshot timestamps required';end if;
   perform (snap->>field)::timestamptz;
  end loop;
  if entry->>'item_type'='saved_search' and not cc_private.named_search_version_source(snap) then raise exception 'Named saved-search history required';end if;
  previous:=coalesce(entry->'recovery','null'::jsonb);
  provenance:=jsonb_build_object('version',1,'snapshotId',p_snapshot_id::text,'restoredAt',to_char(statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'previous',previous);
  if not cc_private.record_version_recovery_valid(provenance) then raise exception 'Bounded exact recovery provenance required';end if;
  insert into cc_private.record_versions(id,owner_id,record_id,source_version,item_type,operation,captured_at,snapshot,recovery) values((entry->>'id')::uuid,auth.uid(),(entry->>'record_id')::uuid,(entry->>'source_version')::integer,entry->>'item_type',entry->>'operation',(entry->>'captured_at')::timestamptz,snap,provenance) returning * into imported;
  return next imported;
 end loop;
end$$;
revoke all on function public.import_private_record_versions(uuid,jsonb) from public,anon;
grant execute on function public.import_private_record_versions(uuid,jsonb) to authenticated;
-- Deparse policy expressions with the same fixed path used by readiness.
set local search_path='';
-- Bind the new ledger to its reviewed body, grants, policies and enabled triggers.
do $install$declare expected text;policy_hash text;begin
 select string_agg(format('(%L,%L,%L,%L,%L)',format('%I.%I(%s)',n.nspname,p.proname,pg_catalog.oidvectortypes(p.proargtypes)),md5(p.prosrc),p.prosecdef,pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'),p.provolatile),',') into expected from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in('cc_private.named_search_version_source(jsonb)'::regprocedure,'cc_private.capture_record_version()'::regprocedure,'cc_private.immutable_record_version()'::regprocedure,'public.list_private_record_versions(uuid,integer)'::regprocedure,'public.get_private_record_version(uuid,uuid)'::regprocedure,'public.export_private_record_versions(uuid)'::regprocedure,'public.lock_private_record_versions_for_recovery()'::regprocedure,'cc_private.record_version_recovery_valid(jsonb,integer)'::regprocedure,'public.import_private_record_versions(uuid,jsonb)'::regprocedure);
 select md5(pg_get_expr(polqual,polrelid)) into policy_hash from pg_policy where polrelid='cc_private.record_versions'::regclass and polname='cc_private_record_versions_read';
 execute format($ready$create function public.cc_private_record_versions_ready() returns boolean language sql stable set search_path='' as $body$
 select auth.uid() is not null and cc_private.development_session_active()
 and(select relrowsecurity from pg_class where oid='public.cc_records'::regclass)
 and(select relrowsecurity and relowner=(select relowner from pg_class where oid='public.cc_records'::regclass) and relowner not in(select oid from pg_roles where rolname in('authenticated','anon')) from pg_class where oid='cc_private.record_versions'::regclass)
 and not pg_catalog.has_schema_privilege('authenticated','cc_private','CREATE')
 and not pg_catalog.has_schema_privilege('anon','cc_private','CREATE')
 and not pg_catalog.has_table_privilege('anon','cc_private.record_versions','SELECT,INSERT,UPDATE,DELETE')
 and pg_catalog.has_table_privilege('authenticated','cc_private.record_versions','SELECT')
 and not pg_catalog.has_table_privilege('authenticated','cc_private.record_versions','INSERT,UPDATE,DELETE')
 and not exists(select 1 from(values %s) e(signature,hash,definer,auth_execute,volatility) left join pg_proc p on p.oid=to_regprocedure(e.signature) where p.oid is null or md5(p.prosrc)<>e.hash or p.proowner<>(select relowner from pg_class where oid='cc_private.record_versions'::regclass) or p.prosecdef is distinct from e.definer::boolean or p.provolatile::text<>e.volatility or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE') is distinct from e.auth_execute::boolean or pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') or p.proconfig is distinct from array['search_path=""']::text[])
 and(select count(*) from pg_policy where polrelid='cc_private.record_versions'::regclass)=1
 and exists(select 1 from pg_policy where polrelid='cc_private.record_versions'::regclass and polname='cc_private_record_versions_read' and polcmd='r' and polpermissive and polroles=array[(select oid from pg_roles where rolname='authenticated')]::oid[] and md5(pg_get_expr(polqual,polrelid))=%L)
 and(select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and tgtype=27 and tgqual is null and tgattr=''::int2vector and tgnargs=0 and ((tgrelid='public.cc_records'::regclass and tgname='cc_capture_private_record_version' and tgfoid='cc_private.capture_record_version()'::regprocedure) or(tgrelid='cc_private.record_versions'::regclass and tgname='cc_immutable_private_record_version' and tgfoid='cc_private.immutable_record_version()'::regprocedure)))=2
 $body$ $ready$,expected,policy_hash);
end$install$;
revoke all on function public.cc_private_record_versions_ready() from public,anon;
grant execute on function public.cc_private_record_versions_ready() to authenticated;
create function public.cc_private_saved_search_versions_ready() returns boolean language sql stable set search_path='' as $$
 select public.cc_private_record_versions_ready() and exists (
  select 1 from pg_catalog.pg_constraint where conrelid='cc_private.record_versions'::regclass and contype='c'
   and position(quote_literal('saved_search') in pg_catalog.pg_get_constraintdef(oid))>0
 );
$$;
revoke all on function public.cc_private_saved_search_versions_ready() from public,anon;
grant execute on function public.cc_private_saved_search_versions_ready() to authenticated;
commit;
