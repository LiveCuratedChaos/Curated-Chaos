-- UNAPPLIED DESIGN DRAFT. Lead review + explicit database approval required.
-- Server identity only. No browser grants; encrypted upstream tokens never leave BFF.
create schema if not exists cc_server;
revoke all on schema cc_server from public, anon, authenticated;
create table cc_server.workspace_sessions (
 key text primary key check (key ~ '^[a-f0-9]{64}$'),
 row_data jsonb not null,
 revision bigint not null default 1,
 idle_at bigint not null,
 absolute_at bigint not null,
 revoked_at bigint,
 lease text,
 lease_until bigint
);
alter table cc_server.workspace_sessions enable row level security;
revoke all on cc_server.workspace_sessions from public, anon, authenticated;
-- SECURITY DEFINER narrowly exposes server-only operations; no dynamic SQL.
create or replace function public.cc_durable_session(operation text, input jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r cc_server.workspace_sessions; t bigint := floor(extract(epoch from clock_timestamp())*1000)::bigint;
begin
 if input->>'key' !~ '^[a-f0-9]{64}$' or input->>'key' is null then raise exception 'Invalid session key'; end if;
 if operation = 'create' then
  if (input->>'idleAt')::bigint <= t or (input->>'absoluteAt')::bigint < (input->>'idleAt')::bigint or (input->>'absoluteAt')::bigint > t+43200000 then raise exception 'Invalid expiry'; end if;
  insert into cc_server.workspace_sessions(key,row_data,idle_at,absolute_at)
   values(input->>'key',input - 'revision' - 'revokedAt' - 'lease' - 'leaseUntil',(input->>'idleAt')::bigint,(input->>'absoluteAt')::bigint) returning * into r;
 elsif operation = 'read' then
  select * into r from cc_server.workspace_sessions where key=input->>'key';
 elsif operation = 'revoke' then
  update cc_server.workspace_sessions set revoked_at=coalesce(revoked_at,t),revision=revision+1,lease=null,lease_until=null where key=input->>'key' returning * into r;
 elsif operation = 'acquire' then
  if input->>'lease' is null or input->>'lease' !~ '^[A-Za-z0-9_-]{43}$' or input->>'leaseMs' is null or (input->>'leaseMs')::bigint not between 100 and 60000 then raise exception 'Invalid lease'; end if;
  select * into r from cc_server.workspace_sessions where key=input->>'key' for update;
  if not found then return null; end if;
  -- A crashed renewal may already have rotated the upstream refresh token. Fail closed;
  -- never steal its expired lease and replay potentially consumed refresh credentials.
  if r.revoked_at is not null then return null; end if;
  if r.idle_at <= t or r.absolute_at <= t or (r.lease is not null and r.lease_until <= t) then
   update cc_server.workspace_sessions set revoked_at=t,revision=revision+1,lease=null,lease_until=null where key=r.key;
   return null;
  end if;
  if r.lease is not null then return null; end if;
  update cc_server.workspace_sessions set lease=input->>'lease',lease_until=t+(input->>'leaseMs')::bigint where key=r.key returning * into r;
 elsif operation = 'commit' then
  update cc_server.workspace_sessions s set row_data=s.row_data || jsonb_build_object('encrypted',input->>'encrypted','user',input->'user'),idle_at=(input->>'idleAt')::bigint,revision=s.revision+1,lease=null,lease_until=null
   where s.key=input->>'key' and s.revision=(input->>'revision')::bigint and s.lease=input->>'lease' and s.lease_until>t and s.revoked_at is null and s.idle_at>t and s.absolute_at>t and (input->>'idleAt')::bigint between s.idle_at and least(s.absolute_at,t+1800000)
   returning * into r;
 else raise exception 'Unknown session operation'; end if;
 if r.key is null then return null; end if;
 return r.row_data || jsonb_build_object('key',r.key,'revision',r.revision,'idleAt',r.idle_at,'absoluteAt',r.absolute_at,'revokedAt',r.revoked_at);
end $$;
revoke all on function public.cc_durable_session(text,jsonb) from public, anon, authenticated;
grant execute on function public.cc_durable_session(text,jsonb) to service_role;
-- Tombstones are retained. A separately reviewed retention/expiry job must not
-- remove identifiers while credentials or in-flight requests could still use them.
