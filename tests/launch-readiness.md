# Launch-readiness batch 1 — local review

Review: `http://localhost:3001/?preview=launch-review`

This DEV-only screen renders the real feed-card, echo picker, reply composer,
cloud and reply-list components with fake data and save callbacks. Reload resets
the sample data. It does not publish replies or echoes. The preview route is
excluded from the production build.

## Implemented

- Matching another user's word no longer prevents echoing it. Own-post protections remain.
- Slider commits start the save immediately (including keyboard input), not on picker dismissal.
- Failed saves restore the confirmed strength and show an error. In-flight saves disable the slider.
- Reply previews are capped at eight candidates, with a 14px minimum and collision checks.
  Replies that cannot fit are omitted from the decorative cloud, not shrunk to tiny text.
  Your reply is considered first; all replies remain available in the readable list.
- The inline reply control includes View all. The scrollable list shows words and @usernames, no timestamps.
- Reopening a previously replied card no longer shows a false success message and closes itself.
- An empty ended Common Wurd round that the player did not enter advances once using the existing acknowledgment RPC.
  Played/populated results are preserved. A failed advance leaves the previous round available.

## Verified locally

- 25 Node tests pass, including bounded layout, minimum text size, no overlaps, and safe round advancement.
- TypeScript and production build pass; existing large-bundle warning remains.
- Browser: matching-word picker opens; keyboard selection saves before closing; simulated failed save rolls back.
- Browser: submit a reply, see it in the cloud, reopen without auto-dismiss, view all 21 replies and authors.
- Browser: clicking list text does not dismiss it; list scrolls; no horizontal overflow at 320px and 433px CSS widths.

## Still required before production sign-off

- Real multi-user staging tests for persistence, lost-response/retry behavior, XP and game acknowledgment.
- Physical iPhone/Android touch, keyboard and offline tests (browser viewport checks are not a substitute).
- Broader audit work: onboarding/cold start, privacy/safety, notifications, history pagination,
  monitoring, performance and Product Hunt launch assets.
- XP formula and category schedule were deliberately not changed in this batch.

No push, deployment or live database changes were made for this batch.
