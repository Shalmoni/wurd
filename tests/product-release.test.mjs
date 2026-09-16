import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { levelDefinitions, levelForXp, levelProgressFor } from '../lib/progression.ts';

test('production XP resets within each level without changing lifetime thresholds', () => {
  assert.deepEqual(levelDefinitions.map(l => l.threshold), [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200]);
  for (const row of levelDefinitions) {
    assert.equal(levelForXp(row.threshold), row.level);
    assert.equal(levelProgressFor(row.threshold, row.level).earned, 0);
    if (row.level > 1) assert.equal(levelForXp(row.threshold - 1), row.level - 1);
  }
  assert.deepEqual(levelProgressFor(117, 2), { earned: 17, required: 200, remaining: 183, percent: 8.5 });
  assert.equal(levelProgressFor(5380, 10).earned, 180);
});

// Wiring checks complement the browser acceptance checks. The approved design
// must not be confined to a DEV route again.
test('production entry includes shared design styles, not the local state engine', () => {
  const entry = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app/CozyPreview.tsx', import.meta.url), 'utf8');
  assert.ok(entry.includes("import './app/product-design.css'"));
  assert.ok(entry.includes("import './app/product-live.css'"));
  assert.ok(app.includes('className="lp live-product today-app"'));
  assert.ok(app.includes('className="lp-xp-pill" onClick={onProgress}'));
  assert.ok(app.includes('<span>Progress</span>'));
  assert.ok(app.includes("(props.panel === 'search' || props.panel === 'friends')"));
  assert.ok(!app.includes("from '../lib/local-product'"));
  assert.ok(!app.includes('className="you-actions"'));
});

test('Play uses the new design with real round submissions and no simulated reveal', () => {
  const play = readFileSync(new URL('../app/PlayTab.tsx', import.meta.url), 'utf8');
  assert.ok(play.includes('Play together.'));
  assert.ok(play.includes('className="lp-game-menu"'));
  assert.ok(play.includes('request = commonWurdRequest'));
  assert.ok(play.includes("request('common_wurd_state')"));
  assert.ok(play.includes("act('submit_common_wurd')"));
  assert.ok(play.includes("act('acknowledge_common_wurd')"));
  assert.ok(play.includes('model.xp_awarded'));
  assert.ok(!play.includes('revealGame('));
  assert.ok(!play.includes('gameSamples'));
});
