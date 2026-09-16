import test from 'node:test';
import assert from 'node:assert/strict';
import { seedLocalState, activePost, canPost, addPost, localEcho, localReply, revealGame, levelProgress, award, streak } from '../lib/local-product.ts';

const saturday = +new Date(2026, 8, 19, 22, 0);
test('local app separates 24-hour lifetime and calendar-day eligibility', () => {
  const posted = addPost(seedLocalState(saturday), 'tired', saturday);
  assert.equal(activePost(posted, saturday + 3 * 3600000).word, 'TIRED');
  assert.equal(canPost(posted, saturday + 3 * 3600000), true);
  assert.equal(canPost(posted, saturday + 3600000), false);
  assert.equal(activePost(posted, saturday + 86400000), undefined);
  assert.throws(() => addPost(posted, 'again', saturday + 3600000));
});
test('replacement keeps history and only one active Wurd, with calendar streak', () => {
  const first = addPost(seedLocalState(saturday), 'tired', saturday);
  const nextDay = saturday + 3 * 3600000;
  const second = addPost(first, 'rested', nextDay);
  assert.equal(second.posts.length, 2);
  assert.equal(second.posts.filter(p => !p.replaced).length, 1);
  assert.equal(activePost(second, nextDay).word, 'RESTED');
  assert.equal(streak(first, nextDay), 1);
  assert.equal(streak(second, nextDay), 2);
  assert.equal(streak(second, nextDay + 2 * 86400000), 0);
  assert.equal(second.ledger.reduce((n,p) => n+p.xp, 0), 10);
});
test('location is saved with the post, not retroactively changed', () => {
  let state = seedLocalState(saturday);
  state.profile = { username: 'tester', city: 'Harish, Israel', joined: saturday, photo: '' };
  state = addPost(state, 'home', saturday);
  state.profile.city = 'London, United Kingdom';
  assert.equal(state.posts[0].city, 'Harish, Israel');
});
test('echo selection replaces the personal strength and gives no sender XP', () => {
  const state = seedLocalState(saturday);
  const first = localEcho(state, 1, 3);
  const second = localEcho(first, 1, 1);
  assert.equal(second.feed[0].echo_count, state.feed[0].echo_count + 1);
  assert.equal(localEcho(second, 1, 0).feed[0].echo_count, state.feed[0].echo_count);
  assert.equal(second.ledger.length, 0);
  assert.deepEqual(second.feed.map(p => p.id), state.feed.map(p => p.id));
  assert.throws(() => localEcho(state, 1, 8));
});
test('one reply per person and Wurd, no reply XP', () => {
  const state = localReply(seedLocalState(saturday), 1, 'felt', saturday);
  assert.equal(state.feed[0].reply_count, 21);
  assert.equal(state.feed[0].replies.at(-1).word, 'FELT');
  assert.equal(state.ledger.length, 0);
  assert.throws(() => localReply(state, 1, 'again', saturday + 1));
  assert.throws(() => localReply(state, 2, 'two words', saturday));
});
test('game group size includes you and the reveal award is idempotent', () => {
  const state = seedLocalState(saturday);
  state.game.answer = 'orange';
  const once = revealGame(state, saturday);
  assert.equal(once.ledger[0].xp, 4);
  assert.equal(revealGame(once, saturday + 1000).ledger.length, 1);
  const unique = { ...state, game: { ...state.game, answer: 'pear' } };
  assert.equal(revealGame(unique, saturday).ledger[0].xp, 1);
  assert.equal(revealGame(seedLocalState(saturday), saturday).ledger.length, 0);
});
test('different level thresholds and level-local XP are preserved', () => {
  assert.deepEqual(levelProgress(100), { level: 2, current: 0, required: 200, remaining: 200 });
  assert.deepEqual(levelProgress(325), { level: 3, current: 25, required: 300, remaining: 275 });
  assert.equal(levelProgress(5300).required, null);
  const first = award(seedLocalState(), 'friend:one', 'Friend', 5, saturday);
  assert.equal(award(first, 'friend:one', 'Friend', 5, saturday).ledger.length, 1);
});
