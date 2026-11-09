-- PREPARED ONLY: separate development database, approval required before execution.
-- Requires 004. Restrictive policies add a session requirement to existing grants.
-- Existing owner/household policies still apply. No app records are modified.
begin;
create policy cc_profile_active_session on public.cc_profiles
 as restrictive for all to authenticated
 using ((select cc_private.development_session_active()))
 with check ((select cc_private.development_session_active()));
create policy cc_household_active_session on public.cc_households
 as restrictive for all to authenticated
 using ((select cc_private.development_session_active()))
 with check ((select cc_private.development_session_active()));
create policy cc_membership_active_session on public.cc_household_memberships
 as restrictive for all to authenticated
 using ((select cc_private.development_session_active()))
 with check ((select cc_private.development_session_active()));
create policy cc_record_active_session on public.cc_records
 as restrictive for all to authenticated
 using ((select cc_private.development_session_active()))
 with check ((select cc_private.development_session_active()));
commit;
