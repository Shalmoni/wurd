# wurd product plan

## Product promise

Open the app once a day, say one honest word, and discover what is resonating with other people without falling into an endless feed.

## Core rules

1. A person can post one word per local calendar day.
2. Today, World, and You remain locked until today's word is posted.
3. Echoes are anonymous. The word owner sees a total, never a list of people.
4. Only the first page of Today is Echoable. The product should feel complete after a few minutes.
5. Friends are a filter inside Today, not a separate main tab.
6. A friend who chose the exact same word gets a mint border and does not need an Echo action.

## Mobile navigation

- **Today:** Twelve two-column cards. Toggle between the most Echoed words and friends' words.
- **World:** Geographic patterns at World, Israel, and Nearby scale. Keep the current concept until the visualization is redesigned to avoid overlapping labels.
- **You:** Streak, XP, level, daily word history, and the story formed by past words. Keep the current concept until its full redesign.

## XP proposal

XP should reward showing up and resonance, without turning the app into a popularity contest.

- Post today's word: **+10 XP**
- Give an Echo: **+1 XP**, limited to the first 3 given per day
- Receive an Echo: **+1 XP for every Echo received**
- Exact daily match with an accepted friend: **+5 XP each**
- Complete every 7-day streak segment: **+25 XP**

Levels unlock visual expression rather than titles: profile color sets, diary treatments, Echo animations, word-card textures, and yearly-story layouts. Core social functions never require a level or payment.

## Backend architecture

GitHub Pages hosts the static React app. Supabase provides:

- passwordless email authentication;
- Postgres tables for profiles, words, Echoes, friendships, and XP events;
- Row Level Security for user-owned data;
- database triggers for tamper-resistant XP awards;
- Realtime updates for Echo totals and the live Today feed.

The browser receives only the Supabase project URL and publishable key. Secret and service-role keys are never bundled into the site.

## Delivery sequence

### Phase 1 — Shareable prototype

- Publish the current mobile-first experience on GitHub Pages.
- Preserve fake community data and local posting so friends can experience the interaction immediately.
- Collect feedback on posting, the twelve-card feed, Echo language, and session length.

### Phase 2 — Friends-and-family alpha

- Connect Supabase Auth and onboarding.
- Replace local words and Echoes with shared data.
- Add friend requests and accepted-friend filtering.
- Add XP ledger, streak calculation, and a compact level indicator.
- Enforce the one-word-per-local-day rule in the database.

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
