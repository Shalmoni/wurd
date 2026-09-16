# Wurd product-improvement release — 2026-09-16

## Follow-up: approved product design integrated

The production entry now uses the approved preview's visual design, not just a
selection of its features. `app/product-design.css` is shared by the isolated
prototype and the real application; `app/product-live.css` adapts existing live
controls. Localhost `/` and `?preview=live` run this backend-connected version.

- Compact, clickable level-local XP pill on Today, Play and You; opens Progress.
- One scrolling page beneath the header, the redesigned daily window/filter row,
  one-column cards, introduction to Play and useful empty states.
- Compact daily composer with unlocked customization in the same dialog.
- Play together menu, countdown, answer review/sealed state, results and explicit
  next-round action using the existing real game RPCs and category schedule.
- You profile, Friends / Progress / Settings, newest-first history with real
  city snapshots and Load earlier days. Search is inside Friends, not a fourth tool.
- Redesigned Progress summary and Settings dialogs; search requests are confirmed
  before sending. Unreached rewards stay hidden through level 10.
- Rounded-rectangle dialogs fix the privacy dialog's oval clipping.

No XP thresholds, awards, user data, backend schema or authentication settings
are changed in this follow-up. The prototype's fake users, local game state and
review controls are not in the production entry or build.

Acceptance: 35 local tests pass (32 release tests plus 3 unrelated local tests),
including production design wiring and real XP thresholds. Production build with
the GitHub Pages base path passes. A DEV-only fixture at
`/tests/product-ui.html` renders the actual production components without a
Supabase client. Browser checks cover 320/390px layouts, a 20-character Wurd,
posting/customization, Friends/search, Progress, Settings, echo/reply opening,
English correction, sealed answers and ended-results-to-next-round navigation.
The fixture and isolated prototype state were checked absent from build assets.
Real-account mutation and physical-phone push/crop tests were not performed.

Deployment `ce67870` succeeded. Read-only acceptance in the existing live @otsar
session confirmed the new header and all three main pages, 10 preserved history
entries, Level 2 with 17/200 XP, the real XP ledger, existing friends, username
autocomplete and the live beach-category round/countdown. No console errors were
observed. No Wurd, echo, reply, friend request or game answer was submitted.

## Release approach

The production app keeps its existing authentication and data services. The isolated
local design model is not a production database. Its mock accounts, fast-forward
controls, fake awards and browser-only actions are excluded from production.
The full exploratory prototype remains at `?preview=product` in development only.

## Integrated into the live application

- Product introduction and data explanation before Google sign-in.
- Optional city, real city suggestions, and an explicit city-search failure state.
- Browse Today before posting; a clear posting action rather than a feed gate.
- Existing calendar-day eligibility, replacement flow, 24-hour expiry and XP rules preserved.
- Stable New / Top / Friends ordering; stale filter responses no longer replace newer ones.
- Same-word echoes work; selection commits immediately, with failure recovery.
- Readable bounded floating replies, your reply prioritized, and a full author list.
- Report and block controls; server-enforced bilateral blocks on posts and interactions.
- Incoming / sent / accepted friend sections and a public invitation link.
- Settings menu, separate notification choices including replies, and installation help.
- Level-local XP, a recent real XP ledger, and undisclosed future rewards.
- Cursor-based history loading, not a permanent fourteen-post cutoff.
- Existing freely positioned, compressed 256px avatar editing retained.
- Private feedback submission, account export, authenticated confirmed account deletion.
- Offline notice, recoverable render-error screen, and tests in deployment CI.
- Removed the unused World map from the main JavaScript bundle.

## Backend deployment

- Migration: `20260916085013_launch_account_safety.sql`.
- `send-push` version 3: requests / friend posts / replies; caller identity and block checks.
- `delete-account` version 1: verifies Auth and a live session, requires DELETE,
  removes the caller's avatar, revokes sessions, then deletes the caller only.
- No existing users, Wurds or XP were reset by deployment.
- Existing push subscriptions have reply notifications OFF until explicitly enabled.

## Verification

- 32 local Node tests pass (29 release tests; 3 belong to the unrelated local Play experiment).
- TypeScript and production build pass; preview module is absent from production assets.
- Database role tests use synthetic users and roll back all writes. Checked bilateral
  visibility, direct/RPC interaction blocking, private report access, export ownership,
  unblocking ownership, and account-data cascades. Tests also pass after migration.
- Both Edge Functions reject requests without authentication with HTTP 401.
- Browser: production-connected signed-out entry and data dialog work.
- Earlier browser checks cover shared echo/reply components, narrow-screen word fitting,
  failed saves, and full local prototype journeys.

## Honest limits / operational follow-up

- Authenticated read-only browser acceptance passed for the deployed redesign
  (see follow-up above); real-account mutation tests were intentionally not run.
- Physical iPhone/Android push delivery, keyboard and photo-crop acceptance remain manual QA.
- Feedback and reports are received in private database queues, not emailed to anyone.
  The app owner needs to review `private.product_feedback` and `private.community_reports`
  in Supabase SQL Editor; no automated moderation or response-time promise is made.
- Privacy screens describe the implemented data flows; a formal launch policy, contact
  details, custom domain / Google consent branding, PH assets and monitoring are separate
  launch follow-ups, not silently simulated features.
- Existing security advisories remain for six authenticated, intentionally privileged legacy
  RPCs and leaked-password protection (the UI uses Google sign-in). The new RPC wrappers
  are invoker functions; privileged implementations are in the non-exposed private schema.
  Private tables intentionally deny direct client access; RLS/no-policy INFO notices are expected.
- Main bundle is about 669 KB (202 KB gzip), down from ~785 KB (247 KB gzip), but still
  exceeds Vite's 500 KB warning threshold. Additional splitting is future work.

## Recovery

The schema changes are additive and backward-compatible with the prior app. If frontend
rollback is necessary, revert the release commit and let Pages redeploy; keep the additive
schema and backend endpoints. Do not reset users or drop data tables to roll back the UI.
