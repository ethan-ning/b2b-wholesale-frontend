/**
 * Reads a session back out of localStorage without trusting it.
 *
 * A stored value can be nonsense — the literal string "undefined" from a response that
 * did not carry a token, or a shape from an older release. JSON.parse throws on both, and
 * because the store reads at module scope that throw takes the whole app down to a blank
 * page, with no way back except clearing storage by hand. A bad session is a logged-out
 * one instead.
 */
export function readSession<T>(tokenKey: string, userKey: string): { token: string | null; user: T | null } {
  const token = localStorage.getItem(tokenKey);
  const rawUser = localStorage.getItem(userKey);

  if (!token || token === 'undefined' || token === 'null' || !rawUser) {
    return forget(tokenKey, userKey);
  }

  try {
    const user = JSON.parse(rawUser) as T;
    return user ? { token, user } : forget(tokenKey, userKey);
  } catch {
    return forget(tokenKey, userKey);
  }
}

function forget(tokenKey: string, userKey: string) {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  return { token: null, user: null };
}
