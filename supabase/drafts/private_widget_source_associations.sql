-- UNAPPLIED candidate: durable private note/project widget aliases.
-- Requires the existing cc_records/auth session model and a reviewed layout
-- save first. Aliases may appear in layout DTOs; source record IDs never do.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

create table cc_private.widget_source_associations(
 owner_id uuid not null references auth.users(id),
 association_id uuid not null,
 record_id uuid not null references public.cc_records(id) on delete cascade,
 item_type text not null check(item_type in('note','project')),
 created_at timestamptz not null default statement_timestamp(),
 primary key(owner_id,association_id)
);
create index cc_widget_source_associations_record on cc_private.widget_source_associations(owner_id,record_id);
alter table cc_private.widget_source_associations enable row level security;
revoke all on cc_private.widget_source_associations from public,anon,authenticated;

create function cc_private.widget_layout_references_association(p_layout jsonb,p_key uuid,p_item_type text) returns boolean language sql immutable set search_path='' as $$
 select jsonb_path_exists(p_layout,'$.** ? (@.sourceAssociationId == $key && @.type == $widgetType)',jsonb_build_object('key',p_key::text,'widgetType',case p_item_type when 'note' then 'notes' else 'projects' end))
$$;
revoke all on function cc_private.widget_layout_references_association(jsonb,uuid,text) from public,anon,authenticated;

create function public.cc_set_widget_source_association(p_association_id uuid,p_record_id uuid,p_item_type text,p_layout_record_id uuid,p_layout_version integer,p_source_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;source_row public.cc_records%rowtype;layout_row public.cc_records%rowtype;prior cc_private.widget_source_associations%rowtype;
begin
 actor:=auth.uid();
 if current_setting('role',true) is distinct from 'authenticated' or actor is null or not cc_private.development_session_active()
 or p_association_id is null or p_record_id is null or p_layout_record_id is null or p_layout_version is null or p_layout_version<1 or p_source_version is null or p_source_version<1 or p_item_type not in('note','project') then raise exception 'Active private widget setup required';end if;
 select * into layout_row from public.cc_records where id=p_layout_record_id and owner_id=actor and household_id is null and visibility='private' and deleted_at is null and item_type='dashboard_layout' and origin='M2B_DEV_WIDGETS' and version=p_layout_version for share;
 if not found or not cc_private.widget_layout_references_association(layout_row.payload,p_association_id,p_item_type) then raise exception 'Saved widget association is not current';end if;
 select * into source_row from public.cc_records where id=p_record_id and owner_id=actor and household_id is null and visibility='private' and deleted_at is null and item_type=p_item_type and version=p_source_version and payload->'fictional'='true'::jsonb and jsonb_typeof(payload->'title')='string' and char_length(btrim(payload->>'title')) between 1 and 200 and (p_item_type<>'note' or section='Personal Life') for share;
 if not found then raise exception 'Current private note or project required';end if;
 select * into prior from cc_private.widget_source_associations where owner_id=actor and association_id=p_association_id for update;
 if found and (prior.record_id<>p_record_id or prior.item_type<>p_item_type) then raise exception 'Widget alias already belongs to another source';end if;
 if not found then insert into cc_private.widget_source_associations(owner_id,association_id,record_id,item_type) values(actor,p_association_id,p_record_id,p_item_type);end if;
 return jsonb_build_object('associationId',p_association_id,'saved',true);
end$$;
revoke all on function public.cc_set_widget_source_association(uuid,uuid,text,uuid,integer,integer) from public,anon;
grant execute on function public.cc_set_widget_source_association(uuid,uuid,text,uuid,integer,integer) to authenticated;

create function public.cc_resolve_widget_source_association(p_association_id uuid) returns table(record_id uuid,item_type text) language plpgsql stable security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=auth.uid();
 if current_setting('role',true) is distinct from 'authenticated' or actor is null or not cc_private.development_session_active() or p_association_id is null then raise exception 'Active private widget view required';end if;
 return query select r.id,a.item_type from cc_private.widget_source_associations a join public.cc_records r on r.id=a.record_id and r.owner_id=a.owner_id and r.visibility='private' and r.household_id is null and r.deleted_at is null and r.item_type=a.item_type and r.payload->'fictional'='true'::jsonb and jsonb_typeof(r.payload->'title')='string' and char_length(btrim(r.payload->>'title')) between 1 and 200 and (a.item_type<>'note' or r.section='Personal Life') where a.owner_id=actor and a.association_id=p_association_id;
end$$;
revoke all on function public.cc_resolve_widget_source_association(uuid) from public,anon;
grant execute on function public.cc_resolve_widget_source_association(uuid) to authenticated;
commit;
