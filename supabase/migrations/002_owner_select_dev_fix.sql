-- Curated Chaos M0B dev-only correction ALREADY APPLIED in this user's development project.
-- Historical migration documentation only; no need to re-run after 23 RLS checks passed.
-- Do not run against original production project.
ALTER POLICY cc_household_member_select ON public.cc_households
USING (owner_id = (SELECT auth.uid()) OR cc_private.is_active_member(id));
