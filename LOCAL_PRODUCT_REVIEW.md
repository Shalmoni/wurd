# wurd — full local product-design pass

Open **http://localhost:3001/?preview=product** for the isolated design prototype.
The default development route now runs the backend-connected release application.
The previous `?preview=launch-review` URL opens the same full experience.
The earlier two-card testing screen remains at `?preview=card-review`.

## What this is

A complete interactive local product prototype, not a release to real users.
It reuses the real card renderer, echo picker, reply composer, readable reply list,
floating-reply layout, and English spelling worker. The new application shell,
journeys and account/game state run locally. State persists under
`wurd:local-product:v1`, separate from live authentication and account storage.

The Supabase client is not initialized on the full-preview routes. Those routes
and their sample content are removed from production builds. No live database,
authentication configuration, notification permissions, or deployment was changed.

## Explore normally

1. **First visit:** clear product promise, example Wurd, three understandable actions,
   local entry without Google, username availability against sample users, optional
   suggested city. New local accounts have no invented post history or earned XP.
2. **Today:** browse without a posting gate; share a daily Wurd; keep a still-active
   previous-day Wurd or replace it; expiry and calendar eligibility stay separate.
   The main word fits on one line, including long words on narrow screens.
3. **Feed:** New / Top / Friends; stable order until refresh; one-column cards;
   readable username and city; explicit reply/echo controls; immediate echo saving;
   a bounded floating preview plus the full readable reply list.
4. **Friends:** search sample usernames, confirm requests, see pending outgoing
   requests, accept/decline incoming requests, unfriend, and copy a local invitation.
5. **Safety:** per-post menu, report reason, block confirmation, hidden blocked
   posts, blocked-account management. Reports stay in a local queue.
6. **Play:** visible entry, game menu, explanatory help, English spelling review,
   answer confirmation, sealed state, timed/manual reveal, results and XP award,
   then next round. Three sample rounds make the local journey easy to exercise;
   the real 100-day category schedule is untouched.
7. **You:** username, membership date, Friends/Progress/Settings, full post history
   with a load-earlier action and saved posting-city snapshots.
8. **Progress:** separate level and level-local XP, variable thresholds, explanation
   of earning sources, recent awards, levels 1–10 with unreached rewards hidden.
9. **Customization:** font and color choices, curated/any-single-emoji gates,
   animation choices, and a profile-photo editor with free positioning, zoom,
   a circular preview and a 256px compressed output. Preview high levels through
   Review tools without changing earned XP.
10. **Settings:** username/city editing, Home Screen instructions using the real W
    icon, separate request/post/reply alert preferences, help, feedback, export,
    local-account deletion, logout and re-entry.

## Review tools

The small top bar opens a separate testing panel; it is not a fourth main tab.
Try empty/populated feed, offline failure, next local day, +24 hours, a game reveal,
a friend's reply/echo on your Wurd, outgoing-request acceptance, higher-level
customization, and a full restart. The local diagnostic counter records interaction
names only; it does not send analytics anywhere.

## Deliberately explicit local simulations

- Sample people do not represent live accounts. Search is against five sample users.
- Cities use a small curated local list, not the production worldwide search.
- Requests and replies do not contact another device. The review panel simulates recipients.
- Push preferences do not request operating-system permission or deliver notifications.
- Reports and feedback are stored locally, not submitted to a moderator or support inbox.
- Blocking changes the local user's view; real cross-account enforcement is not implemented here.
- Local account deletion/export affect this prototype only.
- Privacy copy is an experience prototype, not a completed legal policy.
- The preview invitation is a localhost URL, not a publicly reachable production invite.

## Validation

- 32 tests pass: existing posting/schedule/spelling tests plus local expiry, eligibility,
  replacement, streak, XP, reply uniqueness, location snapshots, bounded layout,
  round advancement and idempotent game awards.
- TypeScript and production build pass. The existing main-bundle size warning remains.
- Browser checks: first visit, optional-city onboarding, daily post/XP, typo review
  (`organe` → `orange`), sealed answer, reveal awarding 4 XP, request acceptance,
  next-day replacement, advanced customization controls, blocking and reload persistence.
- A 20-character Wurd was checked within its visible bounds at 390px and 320px widths.
- Physical-device testing, photo-upload/crop interaction QA, live multi-user tests,
  server-side safety enforcement, real push delivery, monitoring, final policies,
  branded-domain/Google-consent setup, and launch assets remain release work.

The original pass was isolated. The approved visual design has now been ported
to the real app (see RELEASE_READY.md). Shared styles live in product-design.css;
the backend-connected version is at localhost `/` or `?preview=live`.
This prototype remains isolated for experimentation and never becomes the source
of production accounts, game answers or XP.
