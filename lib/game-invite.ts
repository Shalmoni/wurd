export const GAME_INVITE_KEY = 'wurd:pending-game-invite:v1';
const MAX_AGE = 60 * 60 * 1000;

export function isGameInvite(search: string) {
  return new URLSearchParams(search).get('game') === 'common-wurd';
}

// Deliberately share only the game destination, never an answer, auth code,
// preview flag, or an arbitrary redirect. Old links still open the game.
export function gameInviteUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.search = '?tab=play&game=common-wurd';
  url.hash = '';
  return url.href;
}

export function pendingGameInvite(storage: Pick<Storage, 'getItem'>, now = Date.now()) {
  try {
    const saved = Number(storage.getItem(GAME_INVITE_KEY));
    return saved > 0 && now >= saved && now - saved < MAX_AGE;
  } catch { return false; }
}

export function rememberGameInvite(storage: Pick<Storage, 'setItem'>, now = Date.now()) {
  try { storage.setItem(GAME_INVITE_KEY, String(now)); } catch { /* Storage may be disabled. */ }
}

export function clearGameInvite(storage: Pick<Storage, 'removeItem'>) {
  try { storage.removeItem(GAME_INVITE_KEY); } catch { /* Storage may be disabled. */ }
}
