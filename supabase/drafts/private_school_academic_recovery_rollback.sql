-- PREPARED ONLY. Refuse removal while any retained recovery reservation exists.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$begin if current_setting('transaction_isolation')<>'read committed' then raise exception 'Academic recovery rollback requires read committed';end if;end$$;
lock table public.cc_records in access exclusive mode nowait;
do $$begin if exists(select 1 from public.cc_records where payload?'academicRecoveryVersion' or payload?'removedAcademicRecords') then raise exception 'Retained academic recovery records prevent rollback';end if;end$$;
drop function if exists public.cc_private_school_recovery_ready();
drop trigger cc_school_academic_recovery_guard on public.cc_records;
drop function cc_private.school_recovery_guard();
drop function cc_private.school_recovery_payload(jsonb);
drop function cc_private.school_recovery_time(jsonb);
drop function cc_private.school_recovery_active_ids(jsonb);
commit;
