-- Removes the prepared enforcement objects without changing any records.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';
lock table public.cc_records in share row exclusive mode nowait;
drop trigger cc_guard_record_restore_window on public.cc_records;
drop function cc_private.guard_record_restore_window();
drop function cc_private.within_record_restore_window(timestamptz, timestamptz);
commit;
