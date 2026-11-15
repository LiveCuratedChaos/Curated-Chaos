# Supabase sign-in and recovery setup

Prepared November 14, 2026. Local implementation and fictional acceptance only; recovery is disabled for real accounts and the live app is unchanged.

## Existing sign-in

The separate HTTPS email/password sign-in candidate reuses the tested server-side session service. It accepts only its exact configured origin over direct TLS, rejects forwarded headers, retains credentials server-side, and uses a Secure/HttpOnly/SameSite=Strict host cookie. Existing Mac workspace sign-in remains unchanged. This is not a deployed cross-device release.

## Prepared password recovery

The recovery page requests an emailed OTP, verifies it specifically as `recovery`, then lets the owner privately enter matching new passwords. It never opens workspace records, integrations or backups. Verification obtains a separate recovery-only session retained in memory; that session is never adopted as a workspace login or exposed to browser JavaScript. No service-role key is used.

An opaque, separately named cookie and CSRF token bind requests to the initiating browser. Recovery requires exact same origin, fixed routes, bounded JSON and explicit password-change confirmation. The adapter has no arbitrary redirect target. Email responses are generic even when the provider rejects the request; this is not a claim of timing-independent enumeration resistance. Code checks are limited to five, requests are throttled per email and globally, flows/capacity are bounded, verification expires within three minutes, and sessions are closed on cancellation, expiry, invalid responses or disposal. These are single-process in-memory protections; distributed limits and deployment lifecycle still need release validation.

A successful password update attempts global session revocation, then requires ordinary sign-in. Failure to confirm global revocation is disclosed. An uncertain update closes the local flow and is never automatically retried. User chooses and submits real passwords privately; do not automate real credential entry or copy it into chat. Account creation is not enabled.

## Concrete setup awaiting account access

1. Open the Supabase dashboard. Owner signs in privately if necessary.
2. Inspect only the already configured separate development project; verify its identity against the local development guard. Do not edit the original/live project.
3. Read current password-recovery email template, OTP settings, sender/SMTP restrictions, and password security requirements. Do not display credentials or private account lists.
4. Preserve the existing template privately before proposing a change. Proposed template: `supabase/templates/recovery-code.html`, using `{{ .Token }}`. It contains no links or credentials. Subject proposal: `Your Curated Chaos password recovery code`.
5. Obtain concrete approval before saving the development template or other auth settings, sending a real recovery email, or enabling a real-account endpoint. Do not purchase email delivery or hosting without approval. The supplied Supabase email service is limited and best-effort; review actual dashboard availability rather than promise delivery.
6. Use an owner-approved designated development account for one real email/code check. Never reset configured test-account passwords automatically: other local tools depend on them. Owner must handle any real password change and its secure local credential update.
7. Keep recovery default-off until email delivery, user verification, password update, required sign-out behavior and ordinary sign-in after recovery are verified. Do not deploy or change the live app as part of this setup.

## Evidence

All 1,595 offline tests pass, including privacy, whitespace and launcher checks. Added 15 recovery tests covering fixed Supabase auth-only routes, recovery-type code verification, foreign users, uncertain and duplicate updates, capacity, throttling, expiry, cancellation/disposal races, HTTPS/cookie/CSRF enforcement, bounded bodies and the default-off sign-in link.

Fictional browser acceptance passed the email/code/password flow, incorrect-code rejection, mismatched-password validation, final sign-in-required state, focus transitions and clearing email/code fields. The fixture factory cannot accept an external API and sends no email or real password changes. Proof: `/private/tmp/curated-password-recovery-fictional.png`.

## Primary references

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/reference/javascript/auth-verifyotp
- https://supabase.com/docs/reference/javascript/auth-updateuser

## Dashboard inspection — November 14

Supabase dashboard was already authenticated. Verified the separate development project matches the guarded local reference; original/live project was not opened. The default project branch is labeled PRODUCTION by Supabase, but it belongs to the separate development project, not the original app. Its overview briefly reported Unhealthy; a read-only `/auth/v1/health` check returned HTTP200. Do not interpret the overview warning as a diagnosed or resolved outage.

The development Emails/Templates page states “Set up custom SMTP to edit templates” and that default templates are used until then. SMTP Settings shows Toggle SMTP=false. No settings were edited, no credentials read, no recovery messages sent, and no template backup/change was attempted because editing is blocked by the current delivery setup. The exact next dependency is choosing/configuring an email sender; first ask whether the owner already controls a domain, then research a suitable low-cost provider and present exact costs/settings for approval. Dashboard remains open to development SMTP settings. Existing private Mac preview was not restarted or altered during this work.

## Sender information and pending handoff — November 14

Owner supplied livecuratedchaos.com and hello@livecuratedchaos.com. Public DNS lookup shows Porkbun nameservers and iCloud inbound MX records. Preserve these inbound records; no DNS or mailbox changes were made. Recommended Resend Free based on current published limits (3,000 emails/month,100/day) and documented Supabase SMTP support. No paid subscription is needed for the proposed initial volume. Resend account creation is pending owner completion because it involves private credential entry and acceptance of terms. In-app browser tab4 is at Resend signup; tab3 remains at development Supabase SMTP. Do not treat the handoff as completed until the signed-in dashboard is observed.

After signup: inspect existing Resend domains first; prepare only sending-domain verification using provider-issued DNS records, preserving iCloud inbound routing and existing SPF/DMARC. Obtain action-time approval for new sending credentials/domain delegation before applying. Do not enable inbound receiving or public exposure. Prefer a sending-only least-privilege key; keep it out of chat, screenshots, source and logs. Proposed SMTP host smtp.resend.com,port465,username resend, sender hello@livecuratedchaos.com,display name Curated Chaos. Password is a provider-issued key entered privately/through an authorized secure path, never the mailbox password. Review exact records and auth setting changes before saving. No actual message send or password change is authorized by the domain/address disclosure alone.

References: https://resend.com/pricing ; https://resend.com/docs/send-with-supabase-smtp ; https://resend.com/docs/dashboard/domains/introduction .

## Resend account confirmed and domain staged — November 14

Observed signed-in Resend dashboard after owner completed signup. There were no domains. Added inert pending domain livecuratedchaos.com in US East1, default Return-Path `send`, with open/click tracking off and receiving off. Pending-domain setup URL ends /domains/add/18cacc09-e85d-4dab-bcb7-7bf9d5b406ee. This generates verification records only; no DNS records have been written, no API key created, no emails sent, no Supabase settings changed. Public DNS checks found no current TXT at resend._domainkey, no CNAME at send or rsend, no MX at send and no DMARC TXT. Root has iCloud SPF and Apple domain verification; preserve all.

Resend-issued records displayed in this account: TXT resend._domainkey (provider-issued public DKIM key), CNAME rsend → rsend.forge.rmta.net, CNAME send → send.forge.rmta.net. Re-read exact current values before proposing any DNS write; do not replace with older documentation's generic MX/SPF examples. Resend also suggests optional DMARC p=none; do not add that automatically or weaken an existing policy. Need registrar access to inspect zone-level conflicts before a concrete DNS approval. New DNS authorization delegates sending and requires action-time confirmation before applying.

Clicked Resend's Go to Porkbun. Tab5 shows Porkbun login with CAPTCHA and terms; owner must sign in privately and handle verification. Marked handoff, not completed. Tab4 pending Resend setup and tab3 development SMTP preserved. Ask owner to sign in only, leaving DNS unchanged. Do not request passwords, recovery codes or full-access registrar/API keys in chat.

## Registrar inspected; DNS change awaiting confirmation

Confirmed Porkbun signed in. DNS drawer contains exactly five existing records: iCloud DKIM sig1._domainkey CNAME, two root iCloud MX records, root Apple verification TXT, root iCloud SPF TXT. No send/rsend/resend._domainkey conflicts. Saved a new exclusive mode0600 snapshot plus exact proposed additions under ignored .local/dns-reviews/resend-<timestamp>.json; no credentials included. Prepared but did not save a TXT form with host resend._domainkey, exact Resend public DKIM value, TTL600. Remaining proposed additions are CNAME rsend→rsend.forge.rmta.net and send→send.forge.rmta.net, TTL600. No receiving/tracking/DMARC changes. In-app Porkbun tab5 contains the unsaved form. Need action-time owner confirmation to add these three records and let Resend verify sending-domain control. No API key, SMTP change, recovery email or real password update included in that approval.

## Approved DNS changes applied

Owner explicitly approved adding the three DNS records and verifying Resend. Added only TXT resend._domainkey and CNAME rsend/send with the prepared exact values, TTL600. Verified Porkbun now has eight records and all five original rows remain byte-for-byte equal to the local snapshot. Saved an exclusive mode0600 after-snapshot beside the before-snapshot. Authoritative Porkbun DNS answers show all three correct records. Asked Resend to verify; its domain page is still Pending, with the send CNAME already marked Verified while DKIM and rsend propagate. Continue checking until verified or an actual failure requires intervention.

Prepared Resend key dialog with Sending access, but the domain selector currently offers only All domains while verification is pending; do not create an all-domain key as a workaround. No key created. Development Supabase SMTP form was already toggled open with empty fields when revisited; filled only public sender/name/host/username, port465. Password remains empty and no Save changes clicked. This remains an unsaved configuration draft; do not treat SMTP as active. Need separate action-time approval before minting a domain-restricted sending key or saving SMTP/email-template changes.

## DNS verified; next credential approval ready

Resend now displays overall Verified and all three required DNS rows Verified. Original iCloud rows preserved exactly; authoritative DNS also confirms additions. Proof /private/tmp/curated-resend-verified.png. No further propagation work remains for these records.

Prepared but did NOT submit a new key dialog: name Curated Chaos development auth email, permission Sending access, domain livecuratedchaos.com only. It now correctly offers the verified domain; no all-domain/full-access key is needed. Tab6 has the unsaved proposal, screenshot /private/tmp/curated-resend-restricted-key-proposal.png. Tab3 has unsaved public SMTP fields only: hello@livecuratedchaos.com / Curated Chaos / smtp.resend.com /465 /resend, password empty.

Next concrete approval: create this one domain-restricted sending key and store it only as SMTP password in the separate development Supabase project to route auth/recovery emails through Resend. No source-code/chat/log exposure or purchases, and no live/original project edit. No actual test email or password change included. Recover current template after SMTP configuration permits reading/editing; preserve before proposing any change. Real password entry stays owner-only.

## Restricted key created; private transfer needs owner

Owner explicitly approved creating domain-only sending access and saving it in the separate development Supabase project. Created the key named Curated Chaos development auth email with Sending access restricted to livecuratedchaos.com. Observed one key and its View API Key dialog; no secret printed, saved to file, logged or added to source. Automated private transfer unavailable: password-field reads are redacted, and the Copy→paste path returned a virtual-clipboard-empty error. Do not bypass redaction or fill a redacted placeholder. Cleared the unusable transient variable; Supabase SMTP_PASS is confirmed empty and Save changes was NOT clicked.

Owner handoff: in Resend tab6 click Copy to clipboard, privately paste into Supabase tab3 SMTP Password, leave Save changes for the agent and reply pasted. Both tabs marked handoff and the one-time key dialog intentionally remains open. Never ask for the key in chat or take screenshots with it visible. Approval to save the exact development SMTP settings persists after the private paste; do not ask again for that same approved step. No email/template/password/account record change occurred. Need verify masked password populated, exact public settings and guarded project, click Save, re-read stored non-secret SMTP fields, then inspect/preserve the current recovery template before proposing its modification.

## Development SMTP saved; template staged for approval

Owner pasted the new sending key privately and requested continuation. Verified password field populated without reading it; re-entered only the approved public sender address and SMTP username because their browser values are redacted. Clicked Save changes in the guarded development project. Supabase displayed Successfully updated settings. Reload confirmed SMTP enabled, smtp.resend.com and Curated Chaos sender name persisted; password remains masked. Closed the one-time Resend key display using Done. No key stored in local files or code.

Inspected the now-editable Reset password template. Preserved existing subject/body in a new mode0600 ignored local backup under .local/auth-setting-reviews/recovery-before-<timestamp>.json. Default subject Reset your password and body used ConfirmationURL. Staged subject Your Curated Chaos password recovery code and the prepared recovery-code.html body. Monaco input initially appended text, corrected with editor Select All/replace; removed one automatically inserted trailing character. Preview now exactly shows the proposed heading/code/private handling notice, no link and no stray character. Save changes has NOT been clicked. Tab3 remains at template Preview with unsaved changes. Proof /private/tmp/curated-recovery-code-template-preview.png.

Prepared tools/request-development-recovery-email.mjs: default plan-only, exact project guard, explicit one-email/template-reviewed flags, only configured development account A and auth/recover operation, no arbitrary recipient override, no sign-in/record access/password update and no automatic retry. Three fictional tests added. Actual request has NOT run. hello@livecuratedchaos.com is the sender mailbox, not either configured development test account; do not create an account or change test-account email/password to make delivery testing easier.

Next concrete approval: save the staged code-only recovery template in development and request one recovery email to existing configured development account A's sign-in address. This sends a real email/code; owner must read/enter privately, never paste code in chat. No password change or live project change included. Current SMTP-save approval consumed successfully; do not save template or send until separately authorized.

## Approved template and single real email completed

Owner explicitly approved saving the staged development recovery template and sending one test email to the configured development sign-in address. Supabase reported Successfully updated email template. Reload confirmed persisted subject and code-only content; source rendered Token and no ConfirmationURL. Preview proof /private/tmp/curated-recovery-template-saved.png. Ran the guarded request tool exactly once for the approved separated development project. API accepted one request; no retry. Resend email list metadata subsequently showed delivered for the recovery subject; no message detail/body/code opened. Real passwords, app records and live/original project remain unchanged.

Prepared tools/verify-development-recovery-code.mjs as a short-lived loopback-only user-entered code test. Default CLI plan-only; exact development project required. It does NOT send email or provide password-update/account-change routes. Requires same-origin cookie+CSRF, bounded256byte JSON, at most5 attempts and expires3min after opening. Owner enters the already-sent code privately; adapter verifies type recovery and matching user, then immediately closes that recovery session locally. Only safe result flags are printed. Four fictional tests added. No code has been entered or verified yet. After starting this helper, owner handoff is required; do not inspect code field or request code in chat. After success/expiry, stop exact helper runtime and close its tab; no automatic resend.

## Real recovery code verified and cleaned up

Owner reported success. Code-check runtime67640 printed only safe result flags: verified=true,sessionClosed=true,passwordChanged=false,recordsAccessed=false. Browser DOM confirmed the success message, empty code input and hidden form. Saved success-only screenshot /private/tmp/curated-real-recovery-code-verified.png, closed its tab7 and stopped the exact helper runtime. No code was read or displayed by the agent. No password changes or further email requests occurred. Code verification approval is consumed; do not automatically resend or replay a code.

Prepared tools/development-password-recovery-server.mjs for reusable owner-controlled recovery on this Mac. Default is plan-only with no config/network/listener. Actual activation requires an explicit password-recovery flag and exact separated project. The HTTP recovery factory has a narrowly gated fixed http://127.0.0.1:5318 development exception and distinct development cookie; normal HTTPS transport remains strict and fixture mode still rejects real APIs. Local listener binds only loopback, lasts at most15min and uses existing same-origin/CSRF/throttle/recovery-only token controls. No email or change occurs just from constructing/opening the page; those require owner actions. This helper has NOT been activated with real accounts; do not reset an existing configured test password without planning the dependent local credential update.

Next essential owner decision for ordinary app sign-in: retain the existing development address that received the verified recovery code, or use hello@livecuratedchaos.com as the eventual owner account address. hello currently serves only as sending mailbox and is not a configured test-account email. Account creation/email migration/password changes are separate explicit actions; do not silently repurpose the sender mailbox as the app owner. Existing address avoids account/record migration and is the recommended shortest route.

## Owner identity retained; integrated Mac entry enabled

Owner chose to keep the existing account email that received the verified recovery code. Do not create or migrate to hello@livecuratedchaos.com; it remains the sending mailbox only. No identity, ownership, password or saved-record changes occurred.

Wired --allow-private-password-recovery through the existing Mac launcher and guarded private preview factory. Recovery uses the same primary loopback5312 listener and is disposed with the workspace, rather than requiring a second ephemeral test service. A distinct recovery cookie and recovery-only service remain separate from ordinary workspace sessions. The recovery factory permits direct HTTP only for explicit development exceptions on exact127.0.0.1 ports5312/5318; HTTPS defaults remain strict and real staging5313 recovery is rejected. Fixture mode still cannot accept real APIs. The public config forwards only a boolean, and the signed-out app shows Forgot your password only under that gate. The older auth-only page also exposes the gated link. Opening either page performs no provider/email/password action; user submission is required. Recovery returns to the main dashboard sign-in when used by the full workspace. Return destinations are restricted to two fixed internal paths; no arbitrary redirect.

All1,609 offline checks pass, including factory route/config forwarding, default-off behavior, exact project/public-config isolation, host rejection, no email-on-open, fixture boundaries, staging-port rejection, UI link gating and main-app return navigation. Previous15 recovery plus mailbox/code-check tests remain green. Browser acceptance on actual Mac service verified the signed-out link, passive real recovery page, cancellation without requesting mail, correct return to the dashboard and successful existing-account sign-in. No new code email was sent, no code/password entered in recovery, and real note text/saved mail stayed unopened. Proof /private/tmp/curated-signin-recovery-enabled.png.

Previous workspace runtime was no longer alive. Started runtime92653, then stopped it with sign-in cleanup confirmed after a return-link refinement; final runtime78091 remains active with unchanged earlier capabilities plus recovery. Owner app tab8 is signed in and preserved. Setup tabs3/4/5/6 remain preserved. No hosting or live-app change. A future real password change must be performed privately by the owner and accompanied by a private local test-credential update if it changes a configured test login; no automatic configuration/password migration was implemented or performed.
