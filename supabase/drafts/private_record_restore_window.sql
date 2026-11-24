-- Prepared for review. Installation adds database checks to existing owner-private restores.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.cc_records in share row exclusive mode nowait;

create function cc_private.within_record_restore_window(removed_at timestamptz, as_of timestamptz)
returns boolean language sql immutable strict
set search_path = ''
as $$
  select pg_catalog.isfinite(removed_at) and pg_catalog.isfinite(as_of)
    and pg_catalog.date_trunc('milliseconds', as_of at time zone 'UTC')
      between pg_catalog.date_trunc('milliseconds', removed_at at time zone 'UTC')
          and pg_catalog.date_trunc('milliseconds', removed_at at time zone 'UTC') + interval '2160 hours';
$$;
revoke all on function cc_private.within_record_restore_window(timestamptz, timestamptz) from public, anon;
grant execute on function cc_private.within_record_restore_window(timestamptz, timestamptz) to authenticated;

create function cc_private.guard_record_restore_window()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.item_type is distinct from old.item_type or
     (new.deleted_at is not null and new.deleted_at is distinct from old.deleted_at) then
    raise exception 'The original removed record type and removal time must be preserved.';
  end if;
  if new.deleted_at is null and
     not cc_private.within_record_restore_window(old.deleted_at, pg_catalog.clock_timestamp()) then
    raise exception 'The record is outside its 90-day restore window.';
  end if;
  return new;
end;
$$;
revoke all on function cc_private.guard_record_restore_window() from public, anon, authenticated;
create trigger cc_guard_record_restore_window before update on public.cc_records
for each row when (
  old.deleted_at is not null and old.visibility = 'private' and old.household_id is null
  and old.item_type in ('task', 'note', 'event', 'project', 'saved_search')
) execute function cc_private.guard_record_restore_window();
commit;
