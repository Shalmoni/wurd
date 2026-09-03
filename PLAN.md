# wurd product plan

## Product promise

Open the app once a day, say one honest word, and discover what is resonating with other people without falling into an endless feed.

## Core rules

1. A person can post one word per local calendar day.
2. The full Today feed and World remain locked until today's word is posted. You is always available.
3. Echoes are anonymous. The word owner sees a total, never a list of people.
4. Only the eight cards on Today are Echoable. The product should feel complete after a few minutes.
5. Friends are a filter inside Today, not a separate main tab.
6. A friend who chose the exact same word gets a mint border and does not need an Echo action.

## Mobile navigation

- **Today:** Eight two-column cards. Toggle between the most Echoed words and friends' words. A single tap Echoes a word, and XP remains visible beside the daily participation count.
- **World:** Geographic patterns at World, Israel, and Nearby scale. Keep the current concept until the visualization is redesigned to avoid overlapping labels.
- **You:** Streak, XP, level, daily word history, and the story formed by past words. Keep the current concept until its full redesign.

## XP system (implemented)

XP should reward showing up and resonance, without turning the app into a popularity contest.

- Post today's word: **+10 XP**
- Give an Echo: **+1 XP**, limited to the first 8 given per day
- Receive an Echo: **+8 XP for every unique Echo received**

The current maximum is **Level 3**:

- **Level 1 — 0 XP:** the core experience and mint words.
- **Level 2 — 100 XP:** add one emoji to the daily word.
- **Level 3 — 300 XP:** choose mint, blue, or coral for the daily word.

The active streak multiplies every XP award: 3 days = 1.1×, 7 = 1.2×, 14 = 1.3×, 30 = 1.4×, and 60 = 1.5×. Awards are rounded to whole XP and recorded in an idempotent server-side ledger.

## Backend architecture

GitHub Pages hosts the static React app. Supabase provides:

- Google authentication and username onboarding;
- Postgres tables for profiles, words, Echoes, friendships, and XP events;
- Row Level Security for user-owned data;
- database triggers for tamper-resistant XP awards;
- Realtime updates for Echo totals and the live Today feed.

The browser receives only the Supabase project URL and publishable key. Secret and service-role keys are never bundled into the site.

## Delivery sequence

### Phase 1 — Shareable prototype (complete)

- Publish the current mobile-first experience on GitHub Pages.
- Preserve fake community data and local posting so friends can experience the interaction immediately.
- Collect feedback on posting, the eight-card feed, Echo language, and session length.

### Phase 2 — Friends-and-family alpha (in progress)

- Connect Supabase Google Auth and username onboarding.
- Replace local words and Echoes with shared data while preserving a no-credentials demo fallback.
- Add friend requests and accepted-friend filtering.
- Add XP ledger, streak calculation, Level 2 emoji, Level 3 colors, and a compact level indicator.
- Enforce the one-word-per-local-day and earned-unlock rules in the database.

### Phase 3 — Product depth

- Redesign World around progressive geographic detail and collision-free summaries.
- Redesign You around the personal story told by a person's word history.
- Add earned visual unlocks and yearly story output.
- Add moderation, account deletion, privacy controls, and basic abuse prevention before wider distribution.

## Alpha success signals

- Most invited users successfully post without explanation.
- People return on at least 3 of their first 7 days.
- Echoes feel meaningful but do not create pressure to perform.
- A normal session stays under roughly three minutes.
