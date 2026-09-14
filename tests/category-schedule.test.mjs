import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CATEGORY_SCHEDULE, categoryForRound } from '../lib/category-schedule.ts';
import { israelRound } from '../lib/category-game.ts';

test('fixed schedule contains exactly the 100 unique approved prompts', () => {
  assert.equal(CATEGORY_SCHEDULE.length, 100);
  assert.equal(new Set(CATEGORY_SCHEDULE.map(row => row.prompt)).size, 100);
  assert.deepEqual(CATEGORY_SCHEDULE.map(row => row.id).sort((a, b) => a - b), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(categoryForRound('2026-09-14-15').prompt, 'Name something you wouldn’t lend a stranger.');
});

test('both rounds use the same category, regardless of when someone opens the app', () => {
  const morning = categoryForRound('2026-09-14-03');
  assert.deepEqual(categoryForRound('2026-09-14-15'), morning);
  const twoHoursIntoRound = israelRound(Date.parse('2026-09-14T14:00:00Z'));
  assert.deepEqual(categoryForRound(twoHoursIntoRound.id), morning);
  assert.equal(morning.day, 1);
  assert.equal(categoryForRound('2026-09-15-03').day, 2);
});

test('all 100 days follow the committed order, without repeats', () => {
  for (let day = 0; day < 100; day++) {
    const date = new Date(Date.parse('2026-09-14T00:00:00Z') + day * 86_400_000).toISOString().slice(0, 10);
    assert.equal(categoryForRound(`${date}-03`).id, CATEGORY_SCHEDULE[day].id);
  }
});

test('category changes at 3 AM Israel, not midnight; DST does not skip a day', () => {
  for (const boundary of ['2026-09-15T00:00:00Z', '2026-10-25T01:00:00Z']) {
    const before = categoryForRound(israelRound(Date.parse(boundary) - 1).id);
    const after = categoryForRound(israelRound(Date.parse(boundary)).id);
    assert.equal(after.day, before.day + 1);
  }
});
