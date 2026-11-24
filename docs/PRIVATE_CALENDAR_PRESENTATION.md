# Saved private Calendar month presentation

Verified November17,2026. This is a bounded R21 workflow. RELEASE_CHECKLIST.md remains authoritative; source/category/household filters, schedule drawer refinements, destination overrides, synchronization and full release/device acceptance remain required.

## Existing behavior and saved choice

The audited Calendar already displayed event titles in month cells. Event details remains the default; no existing mode or saved event is removed. Customize Calendar display offers Event details or Minimal dots. Its temporary draft requires review and approval, survives reload after a verified save, and can be changed back through a fresh review. The choice affects only month cells. Week, Day, Agenda and the full event list preserve their current behavior and records.

Minimal dots shows the existing matching count with an accent-colored indicator for dates containing events. It omits event titles from month-cell markup and accessible labels. Accessible day buttons retain dates, complete matching counts, range status and draft-disabled state. The event list still intentionally exposes the permitted event titles and actions; dots is a visual presentation preference, not a record privacy lock. Existing full-inventory month summaries, pagination/fallback provenance, title filters, overlapping/multiday events and date navigation remain unchanged.

## Shared protected foundation

`src/private-calendar-presentation.mjs` accepts only `{schemaVersion:1,monthDisplay:'details'|'dots'}`. Unsupported future versions and unknown fields fail closed. Invalid saved display settings block the Calendar view rather than silently showing default titles.

`server/private-brief-layout.mjs` now shares the existing reviewed preference engine between two fixed internal policies. The original `createPrivateBriefLayout` behavior remains; `createPrivateCalendarPresentation` modifies only `payload.calendarPresentation`. Neither caller can inject an arbitrary extension or validator. Both preserve the complete other payload, including Brief layout3, theme, density, privacy and unknown extensions. Entire-record base tags make concurrent changes through either feature invalidate an older review; a fresh review preserves the newest other feature settings.

The same owner/context, five-minute view/review bounds, one-use claim, mandatory authorization, optimistic revision, exact microsecond creation/update checks, acknowledged payload verification and complete reread remain. No upsert, automatic write retry, schema migration, new provider read or permission grant is introduced. Uncertain saves retain a locked copy and require inspection/fresh review. Pending writes remain guarded through offline/reset/permission changes, and late replies cannot revive private content.

The independent `--allow-private-calendar-presentation-reviewed` flag requires the private Calendar workspace and dashboard. Defaults are off. Config, client and loopback/direct-TLS routes keep the existing origin/cookie/CSRF boundaries. Only the enabled Calendar page reads these settings or exposes the panel; Daily Brief, Tasks and Notes do not. The owner launcher is unchanged. Native form submission now delegates to the reviewed presentation panels, preserving keyboard access to both Calendar and Brief review.

## Acceptance

All2,183 local tests pass with zero failures/skips/cancellations; privacy/content, whitespace and launcher syntax checks pass. Targeted checks cover strict models, unchanged defaults, metadata, independent extension preservation, cross-feature stale reviews, unauthorized/expired/replayed/uncertain saves, pending lifecycle, HTTP/HTTPS, exact CLI opt-in, root title omission and accessible labels, malformed-setting refusal, draft blockers and keyboard submission. Independent read-only review found no required fixes.

Fictional browser acceptance verified the existing detail default, reviewed dots, two event-day indicators with no month titles or accessible-title leakage, source event retention in the full list, reload persistence, reviewed detail restoration,390px no overflow (document375px), and sign-out clearing. The temporary fictional server/session/tab were stopped/cleared; viewport override reset.104 desktop/narrow browser cases are prepared/discovered, not claimed as executed. Standalone Chromium remains sandbox-restricted, and emulation is not physical-device acceptance.

## Recovery and remaining release work

No owner runtime/launcher restart, real private record, schema, provider, credential, archive/key, production, hosted CI, branch/publication, spending or deployment was changed. Other uncommitted work remains preserved.

Disable the new flag to return to the prior Calendar presentation path without changing records. Preserve the saved `calendarPresentation` extension and every other preference extension. Restore the preferred display through a current read and reviewed save, not a copied old payload. Source rollback must selectively remove this feature from shared files while retaining Brief/Calendar/hierarchy/recovery work; never replace entire shared files from an earlier checkpoint.

R21 remains Partial for all other approved Calendar behavior and environment/device acceptance. R16/R17 remain Partial for other domains/households, cross-domain intelligence, refresh scheduling/change triggers and protected historical snapshots. No remaining approved requirement is deferred or removed by these milestones.
