begin;

-- An issued invitation targets an already verified adult identity. Issuance
-- and delivery are deliberately separate from this acceptance transaction.
create table cc_private.household_invitations (
 token_hash bytea primary key check (octet_length(token_hash)=32),
 household_id uuid not null references public.cc_households(id),
 issuer_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 check (issuer_id<>recipient_id)
);
revoke all on cc_private.household_invitations from public,anon,authenticated;

create function public.cc_accept_household_invitation(p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare invitation cc_private.household_invitations%rowtype;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' or not cc_private.development_session_active()
 then return false; end if;

 select * into invitation from cc_private.household_invitations
 where token_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'))
   and recipient_id=auth.uid() and accepted_at is null
 for update;
 if not found or invitation.expires_at<=pg_catalog.clock_timestamp() then return false; end if;

 perform 1 from public.cc_households where id=invitation.household_id and owner_id=invitation.issuer_id for share;
 if not found or not cc_private.development_session_active() or invitation.expires_at<=pg_catalog.clock_timestamp()
 then return false; end if;

 insert into public.cc_household_memberships as current_membership
  (household_id,user_id,role,status,read_sections,write_sections)
 values(invitation.household_id,auth.uid(),'adult','active','{}','{}')
 on conflict(household_id,user_id) do update
 set role='adult',status='active',read_sections='{}',write_sections='{}'
 where current_membership.status='removed';
 if not found then return false; end if;
 -- A concurrent membership update can keep the upsert waiting past expiry.
 if invitation.expires_at<=pg_catalog.clock_timestamp() or not cc_private.development_session_active()
 then raise exception 'The invitation is no longer available'; end if;

 update cc_private.household_invitations set accepted_at=pg_catalog.clock_timestamp()
 where token_hash=invitation.token_hash;
 return true;
end;
$$;
revoke all on function public.cc_accept_household_invitation(text) from public,anon,authenticated;
grant execute on function public.cc_accept_household_invitation(text) to authenticated;

commit;
