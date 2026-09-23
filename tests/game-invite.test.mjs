import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_INVITE_KEY, gameInviteUrl, isGameInvite, pendingGameInvite, rememberGameInvite, clearGameInvite } from '../lib/game-invite.ts';

test('share links preserve deployment base but never auth, answers or preview state', () => {
  assert.equal(gameInviteUrl('https://shalmoni.github.io/wurd/?code=secret&answer=orange&preview=play#token'), 'https://shalmoni.github.io/wurd/?tab=play&game=common-wurd');
  assert.equal(gameInviteUrl('http://localhost:3001/'), 'http://localhost:3001/?tab=play&game=common-wurd');
  assert.ok(isGameInvite('?tab=play&game=common-wurd'));
  assert.equal(isGameInvite('?game=https://evil.example'), false);
});

test('game destination survives a clean OAuth callback and is consumed after opening', () => {
  const items = new Map();
  const storage = { getItem: k => items.get(k) ?? null, setItem: (k, v) => items.set(k, v), removeItem: k => items.delete(k) };
  assert.equal(pendingGameInvite(storage, 1000), false);
  rememberGameInvite(storage, 1000);
  assert.equal(pendingGameInvite(storage, 2000), true);
  assert.equal(pendingGameInvite(storage, 3601000), false);
  assert.equal(pendingGameInvite(storage, 999), false);
  clearGameInvite(storage);
  assert.equal(items.has(GAME_INVITE_KEY), false);
  assert.equal(pendingGameInvite(storage, 2000), false);
});

test('disabled storage does not break navigation helpers', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(pendingGameInvite(blocked), false);
  assert.doesNotThrow(() => rememberGameInvite(blocked));
  assert.doesNotThrow(() => clearGameInvite(blocked));
});
