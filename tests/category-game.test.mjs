import assert from 'node:assert/strict';
import { test } from 'node:test';
import { israelRound, normalizeAnswer, answerBoard, menuTimeLeft, roundForReview } from '../lib/category-game.ts';
test('Israel 3 PM boundary has no gap or overlap', () => {
  const boundary = Date.parse('2026-09-14T12:00:00Z');
  assert.equal(israelRound(boundary - 1).endsAt, boundary);
  assert.equal(israelRound(boundary).startsAt, boundary);
  assert.equal(israelRound(boundary).endsAt, Date.parse('2026-09-15T00:00:00Z'));
});
test('DST follows Israel wall-clock boundaries', () => {
  const spring = israelRound(Date.parse('2026-03-26T20:00:00Z'));
  const autumn = israelRound(Date.parse('2026-10-24T20:00:00Z'));
  assert.equal((spring.endsAt - spring.startsAt) / 3_600_000, 11);
  assert.equal((autumn.endsAt - autumn.startsAt) / 3_600_000, 13);
});
test('score equals group size including the player', () => {
  assert.deepEqual(answerBoard(['red', 'red', 'red', 'white', 'blue']), [{ answer: 'red', count: 3 }, { answer: 'blue', count: 1 }, { answer: 'white', count: 1 }]);
});
test('normalize answers without restricting them to a category', () => {
  assert.equal(normalizeAnswer(' RED '), 'red');
  assert.equal(normalizeAnswer('table'), 'table');
  assert.equal(normalizeAnswer('pizza'), 'pizza');
  assert.equal(normalizeAnswer('two words'), null);
  assert.equal(normalizeAnswer(''), null);
  assert.equal(normalizeAnswer('a'.repeat(31)), null);
});
test('menu uses rounded hours or minutes below one hour, then Ended', () => {
  assert.equal(menuTimeLeft(43_200_000, 0), '12h left');
  assert.equal(menuTimeLeft(4.6 * 3_600_000, 0), '5h left');
  assert.equal(menuTimeLeft(5.4 * 3_600_000, 0), '5h left');
  assert.equal(menuTimeLeft(3_600_000, 0), '1h left');
  assert.equal(menuTimeLeft(3_599_000, 0), '59m left');
  assert.equal(menuTimeLeft(16 * 60_000, 0), '16m left');
  assert.equal(menuTimeLeft(59_000, 0), '1m left');
  assert.equal(menuTimeLeft(100, 100), 'Ended');
  assert.equal(menuTimeLeft(100, 101), 'Ended');
});
test('unfinished review keeps the ended round until the next round is acknowledged', () => {
  const before = Date.parse('2026-09-14T11:59:00Z');
  const after = Date.parse('2026-09-14T12:01:00Z');
  const previous = israelRound(before);
  assert.equal(roundForReview(after, String(previous.startsAt)).id, previous.id);
  const next = israelRound(after);
  assert.equal(roundForReview(after, String(next.startsAt)).id, next.id);
  for (const invalid of [null, '', 'invalid', String(after + 1000)]) {
    assert.equal(roundForReview(after, invalid).id, next.id);
  }
});
