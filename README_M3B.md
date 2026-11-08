# Curated Chaos M3B — Widget Customization

Extends the Milestone 3A theme build and existing M2B widget studio. The Curation supports saved per-account, per-device layouts; adding duplicate widgets, hiding, moving, half/full width, and source filters. New in M3B: custom titles and 2/4/6/10 visible record limit per widget. Save Layout explicitly to persist.

Requires existing development Supabase `.env.local` copied from M3A (do not upload or share it); no database migration.

Run `npm test` and `PORT=5212 npm start`. Visit `/dev-workspace.html?page=curation`. See `M3B_TEST_PLAN.md`.

Limitations: fictional records only; account-specific layout isn't applied to other workspace pages; responsive layouts are editable separately.
