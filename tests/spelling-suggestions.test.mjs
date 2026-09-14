import { test } from 'node:test';
import assert from 'node:assert/strict';
import nspell from 'nspell';
import dictionary from 'dictionary-en';
import { spellingSuggestions } from '../lib/spelling-suggestions.ts';
const spell = nspell({ aff: Buffer.from(dictionary.aff), dic: Buffer.from(dictionary.dic) });
test('English suggestions catch the requested typos without category constraints', () => {
  for (const word of ['organe', 'prange']) {
    const result = spellingSuggestions(spell, word);
    assert.equal(result.known, false);
    assert.ok(result.suggestions.includes('orange'));
  }
  assert.deepEqual(spellingSuggestions(spell, 'table'), { known: true, suggestions: [] });
  assert.deepEqual(spellingSuggestions(spell, 'orange'), { known: true, suggestions: [] });
});
test('unknown words have bounded suggestions and are never silently replaced', () => {
  const result = spellingSuggestions(spell, 'qzxqzx');
  assert.equal(result.known, false);
  assert.ok(result.suggestions.length <= 3);
});
