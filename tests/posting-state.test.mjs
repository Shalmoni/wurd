import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountLoadGuard, isSavedWurdActive } from '../lib/posting-state.ts';

const postedAt = '2026-09-10T09:00:20.000Z';
const postedMs = Date.parse(postedAt);

test('a successful post remains visible before the next 30-second UI clock tick', () => {
  assert.equal(isSavedWurdActive(postedAt, postedMs - 20_000), true);
  assert.equal(isSavedWurdActive(postedAt, postedMs), true);
  assert.equal(isSavedWurdActive(postedAt, postedMs + 10_000), true);
});

test('a server timestamp slightly ahead of the device does not reopen the composer', () => {
  assert.equal(isSavedWurdActive(postedAt, postedMs - 2_000), true);
});

test('a saved Wurd expires exactly 24 hours later, not at midnight', () => {
  assert.equal(isSavedWurdActive(postedAt, Date.parse('2026-09-11T00:00:00Z')), true);
  assert.equal(isSavedWurdActive(postedAt, postedMs + 86_400_000 - 1), true);
  assert.equal(isSavedWurdActive(postedAt, postedMs + 86_400_000), false);
});

test('missing and invalid timestamps do not show a saved Wurd', () => {
  assert.equal(isSavedWurdActive(null, postedMs), false);
  assert.equal(isSavedWurdActive('invalid', postedMs), false);
});

test('an account load started before posting cannot clear the successful save', () => {
  const guard = createAccountLoadGuard();
  const beforePost = guard.invalidate();
  guard.invalidate(); // Successful post commits the returned Wurd.
  assert.equal(guard.isCurrent(beforePost), false);
  const afterPost = guard.invalidate(); // Fetch newly earned XP/level.
  assert.equal(guard.isCurrent(afterPost), true);
  assert.equal(guard.isCurrent(beforePost), false);
  guard.invalidate(); // Signing out also invalidates pending responses.
  assert.equal(guard.isCurrent(afterPost), false);
});
