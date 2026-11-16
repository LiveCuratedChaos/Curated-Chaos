-- UNAPPLIED DESIGN: explicit database approval, schema review and hosted validation
-- required. No real provider, consent import, scheduler or public route is enabled.
-- Grant registry is NOT consent by itself: the trusted connection/consent authority
-- must populate it after explicit scope approval, and increment epoch on every
-- revoke/regrant/scope change. Existing local provider stores are not migrated here.
-- An injected privileged SQL/RPC executor calls this private schema. Do not expose
-- this schema to browser PostgREST clients. No raw tokens/content/cursors belong here:
-- checkpoint is a server-sealed envelope, validated/authenticated by its adapter.
begin;
create schema cc_sync_private;
revoke all on schema cc_sync_private from public;
create role cc_sync_worker nologin;
grant usage on schema cc_sync_private to cc_sync_worker;

create table cc_sync_private.connection_grants (
 owner_id uuid not null,
 connection_id uuid not null,
 kind text not null check(kind in ('gmail_metadata','google_calendar','plaid_readonly')),
 epoch integer not null check(epoch>0),
 active boolean not null default false,
 expires_at timestamptz not null,
 primary key(owner_id,connection_id,kind)
);
create table cc_sync_private.jobs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 connection_id uuid not null,
 kind text not null check(kind in ('gmail_metadata','google_calendar','plaid_readonly')),
 idempotency_key uuid not null,
 grant_epoch integer not null check(grant_epoch>0),
 state text not null default 'pending' check(state in ('pending','leased','complete','canceled','failed')),
 checkpoint text check(checkpoint is null or (checkpoint like 'sealed:v1:%' and length(checkpoint)>10 and octet_length(checkpoint)<=16384)),
 attempts integer not null default 0 check(attempts between 0 and 20),
 max_attempts integer not null check(max_attempts between 1 and 20),
 next_run_at timestamptz not null default clock_timestamp(),
 lease_owner uuid,
 lease_token bigint not null default 0 check(lease_token>=0),
 lease_until timestamptz,
 error_code text check(error_code in ('transient','invalid_result','unsupported','consent_revoked','timeout')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(owner_id,connection_id,kind,grant_epoch,idempotency_key),
 foreign key(owner_id,connection_id,kind) references cc_sync_private.connection_grants(owner_id,connection_id,kind),
 check((state='leased')=(lease_owner is not null and lease_until is not null))
);
create index jobs_dispatch on cc_sync_private.jobs(next_run_at,created_at,id) where state in ('pending','leased');
alter table cc_sync_private.connection_grants enable row level security;
alter table cc_sync_private.jobs enable row level security;
revoke all on all tables in schema cc_sync_private from public,cc_sync_worker;

create function cc_sync_private.enqueue(p_owner uuid,p_connection uuid,p_kind text,p_key uuid,p_max_attempts integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,cc_sync_private as $$
declare g cc_sync_private.connection_grants; j cc_sync_private.jobs;
begin
 if p_owner is null or p_connection is null or p_key is null or p_kind is null or p_kind not in ('gmail_metadata','google_calendar','plaid_readonly') or p_max_attempts is null or p_max_attempts not between 1 and 20 then raise exception 'Invalid durable job request'; end if;
 select * into g from cc_sync_private.connection_grants where owner_id=p_owner and connection_id=p_connection and kind=p_kind for share;
 if not found or not g.active or g.expires_at<=clock_timestamp() then raise exception 'Durable job consent unavailable'; end if;
 -- Unique constraint is the atomic idempotency arbiter under concurrent enqueue.
 insert into cc_sync_private.jobs(owner_id,connection_id,kind,grant_epoch,idempotency_key,max_attempts)
 values(p_owner,p_connection,p_kind,g.epoch,p_key,p_max_attempts) on conflict(owner_id,connection_id,kind,grant_epoch,idempotency_key) do nothing returning * into j;
 if not found then select * into j from cc_sync_private.jobs where owner_id=p_owner and connection_id=p_connection and kind=p_kind and grant_epoch=g.epoch and idempotency_key=p_key; end if;
 if j.max_attempts<>p_max_attempts then raise exception 'Durable job idempotency mismatch'; end if;
 return to_jsonb(j);
end $$;

create function cc_sync_private.claim(p_worker uuid,p_lease_ms integer)
returns jsonb language plpgsql security definer set search_path=pg_catalog,cc_sync_private as $$
declare j cc_sync_private.jobs; g cc_sync_private.connection_grants; inspected integer:=0;
begin
 if p_worker is null or p_lease_ms is null or p_lease_ms not between 1000 and 60000 then raise exception 'Invalid durable lease'; end if;
 -- Every invocation scans at most 32 candidates, even if a revoked backlog exists.
 for j in select * from cc_sync_private.jobs where (state='pending' and next_run_at<=clock_timestamp()) or (state='leased' and lease_until<=clock_timestamp()) order by next_run_at,created_at,id for update skip locked limit 32 loop
  inspected:=inspected+1;
  select * into g from cc_sync_private.connection_grants where owner_id=j.owner_id and connection_id=j.connection_id and kind=j.kind for share;
  if not found or not g.active or g.epoch<>j.grant_epoch or g.expires_at<=clock_timestamp() then
   update cc_sync_private.jobs set state='canceled',lease_owner=null,lease_until=null,error_code='consent_revoked',updated_at=clock_timestamp() where id=j.id;
  elsif j.attempts>=j.max_attempts then
   update cc_sync_private.jobs set state='failed',lease_owner=null,lease_until=null,error_code='timeout',updated_at=clock_timestamp() where id=j.id;
  else
   update cc_sync_private.jobs set state='leased',lease_owner=p_worker,lease_until=clock_timestamp()+p_lease_ms*interval '1 millisecond',lease_token=lease_token+1,attempts=attempts+1,updated_at=clock_timestamp() where id=j.id returning * into j;
   return to_jsonb(j);
  end if;
 end loop;
 return null;
end $$;

create function cc_sync_private.authorized(p_id uuid,p_worker uuid,p_token bigint)
returns boolean language sql security definer set search_path=pg_catalog,cc_sync_private as $$
 select exists(select 1 from cc_sync_private.jobs j join cc_sync_private.connection_grants g using(owner_id,connection_id,kind)
 where j.id=p_id and j.state='leased' and j.lease_owner=p_worker and j.lease_token=p_token and j.lease_until>clock_timestamp()
 and g.active and g.epoch=j.grant_epoch and g.expires_at>clock_timestamp());
$$;

create function cc_sync_private.settle(p_id uuid,p_worker uuid,p_token bigint,p_outcome text,p_checkpoint text,p_error text)
returns boolean language plpgsql security definer set search_path=pg_catalog,cc_sync_private as $$
declare j cc_sync_private.jobs; g cc_sync_private.connection_grants; target text;
begin
 if p_id is null or p_worker is null or p_token is null or p_token<1 or p_outcome is null or p_outcome not in ('complete','continue','retry','cancel','fail') or (p_checkpoint is not null and (p_checkpoint not like 'sealed:v1:%' or length(p_checkpoint)<=10 or octet_length(p_checkpoint)>16384)) or (p_error is not null and p_error not in ('transient','invalid_result','unsupported','consent_revoked','timeout')) then raise exception 'Invalid durable job result'; end if;
 select * into j from cc_sync_private.jobs where id=p_id for update;
 if not found or j.state<>'leased' or j.lease_owner<>p_worker or j.lease_token<>p_token or j.lease_until<=clock_timestamp() then return false; end if;
 select * into g from cc_sync_private.connection_grants where owner_id=j.owner_id and connection_id=j.connection_id and kind=j.kind for share;
 if not found or not g.active or g.epoch<>j.grant_epoch or g.expires_at<=clock_timestamp() then
  target:='canceled';p_error:='consent_revoked';p_checkpoint:=j.checkpoint;
 else
  target:=case p_outcome when 'complete' then 'complete' when 'continue' then 'pending' when 'retry' then case when j.attempts>=j.max_attempts then 'failed' else 'pending' end when 'cancel' then 'canceled' else 'failed' end;
 end if;
 update cc_sync_private.jobs set state=target,checkpoint=p_checkpoint,error_code=p_error,lease_owner=null,lease_until=null,
  -- Continuation is a successful bounded page, not a failed attempt. Retry keeps
  -- its attempt budget; exponential backoff caps at one hour. No exactly-once claim.
  attempts=case when p_outcome='continue' and target='pending' then 0 else attempts end,
  next_run_at=clock_timestamp()+case when p_outcome='retry' then least(3600,5*power(2,least(j.attempts-1,10))) else 1 end*interval '1 second',updated_at=clock_timestamp() where id=j.id;
 -- A concurrent revoke must never acknowledge a completion or continuation.
 return target<>'canceled' or p_outcome='cancel';
end $$;

revoke all on all functions in schema cc_sync_private from public;
grant execute on function cc_sync_private.enqueue(uuid,uuid,text,uuid,integer),cc_sync_private.claim(uuid,integer),cc_sync_private.authorized(uuid,uuid,bigint),cc_sync_private.settle(uuid,uuid,bigint,text,text,text) to cc_sync_worker;
-- Single PostgREST-facing server RPC. Existing server service identity may invoke
-- the fixed dispatcher; neither browser role may access the schema or wrapper.
-- Dedicated worker role can later replace the broad service identity after an
-- approved executor binding; no custom browser JWT claim is introduced here.
create function public.cc_durable_sync_job(operation text,input jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if input is null or jsonb_typeof(input)<>'object' then raise exception 'Invalid durable job request'; end if;
 case operation
 when 'enqueue' then return cc_sync_private.enqueue((input->>'p_owner')::uuid,(input->>'p_connection')::uuid,input->>'p_kind',(input->>'p_key')::uuid,(input->>'p_max_attempts')::integer);
 when 'claim' then return cc_sync_private.claim((input->>'p_worker')::uuid,(input->>'p_lease_ms')::integer);
 when 'authorized' then return to_jsonb(cc_sync_private.authorized((input->>'p_id')::uuid,(input->>'p_worker')::uuid,(input->>'p_token')::bigint));
 when 'settle' then return to_jsonb(cc_sync_private.settle((input->>'p_id')::uuid,(input->>'p_worker')::uuid,(input->>'p_token')::bigint,input->>'p_outcome',input->>'p_checkpoint',input->>'p_error'));
 else raise exception 'Invalid durable job operation';
 end case;
exception when others then raise exception 'Durable job request failed';
end $$;
revoke all on function public.cc_durable_sync_job(text,jsonb) from public,anon,authenticated;
grant execute on function public.cc_durable_sync_job(text,jsonb) to service_role;
commit;
