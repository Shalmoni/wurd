import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudReplies, arrangeReplies } from '../lib/reply-layout.ts';
import { skipEmptyUnplayedRound } from '../lib/game-round-navigation.ts';

test('reply preview stays bounded and keeps your reply first', () => {
  const replies = Array.from({ length: 1000 }, (_, i) => ({ user_id: String(i) }));
  const preview = cloudReplies(replies, '999');
  assert.equal(preview.length, 8);
  assert.equal(preview[0], replies[999]);
  assert.equal(new Set(preview).size, 8);
  assert.equal(replies.length, 1000);
});

test('crowded replies stay readable, within bounds, and clear of the main word', () => {
  const obstacle = { x: 60, y: 60, width: 100, height: 40, font: 0 };
  const input = Array.from({ length: 1000 }, () => 'SAME');
  const positions = arrangeReplies(input, 230, 180, obstacle, (word, font) => word.length * font * .7);
  assert.equal(positions.length, 8);
  const placed = positions.filter(Boolean);
  assert.ok(placed.length > 0);
  const occupied = [obstacle];
  for (const p of placed) {
    assert.ok(p.font >= 14);
    assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 230 && p.y + p.height <= 180);
    for (const other of occupied) assert.ok(!(p.x < other.x + other.width && p.x + p.width > other.x && p.y < other.y + other.height && p.y + p.height > other.y));
    occupied.push(p);
  }
  assert.deepEqual(positions, arrangeReplies(input, 230, 180, obstacle, (word, font) => word.length * font * .7));
  assert.deepEqual(arrangeReplies(['IMPOSSIBLE'], 10, 10, obstacle, () => 100), [null]);
});

const empty = { round: { id: 'old' }, ended: true, my_answer: null, answer_count: 0 };
test('empty unplayed round advances exactly once, not in a polling loop', async () => {
  let calls = 0;
  const next = { ...empty, round: { id: 'current' }, ended: false };
  assert.equal(await skipEmptyUnplayedRound(empty, async id => { calls++; assert.equal(id, 'old'); return next; }), next);
  assert.equal(calls, 1);
  assert.equal(await skipEmptyUnplayedRound(empty, async () => empty), empty);
});
test('preserve played results, populated results, active rounds and stale requests', async () => {
  const unexpected = async () => { throw new Error('Must not acknowledge'); };
  for (const state of [{ ...empty, my_answer: 'red', answer_count: 1 }, { ...empty, answer_count: 3 }, { ...empty, ended: false }, { ...empty, round: null }]) {
    assert.equal(await skipEmptyUnplayedRound(state, unexpected), state);
  }
  assert.equal(await skipEmptyUnplayedRound(empty, unexpected, () => false), empty);
});
test('failed advancement is surfaced so UI can retain the previous round', async () => {
  await assert.rejects(skipEmptyUnplayedRound(empty, async () => { throw new Error('Offline'); }), /Offline/);
});
