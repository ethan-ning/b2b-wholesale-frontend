import { beforeEach, describe, expect, it } from 'vitest';
import { readSession } from './storedSession';

beforeEach(() => localStorage.clear());

describe('readSession', () => {
  it('returns a stored session', () => {
    localStorage.setItem('t', 'a-token');
    localStorage.setItem('u', JSON.stringify({ id: 1 }));

    expect(readSession('t', 'u')).toEqual({ token: 'a-token', user: { id: 1 } });
  });

  /**
   * A response without a token stored the string "undefined". JSON.parse throws on it, and
   * because the store reads at module scope that throw was the whole app — a blank page,
   * recoverable only by clearing storage by hand.
   */
  it('treats the literal "undefined" as no session, and clears it', () => {
    localStorage.setItem('t', 'undefined');
    localStorage.setItem('u', 'undefined');

    expect(readSession('t', 'u')).toEqual({ token: null, user: null });
    expect(localStorage.getItem('t')).toBeNull();
  });

  it('survives a user that is not valid JSON', () => {
    localStorage.setItem('t', 'a-token');
    localStorage.setItem('u', '{not json');

    expect(readSession('t', 'u')).toEqual({ token: null, user: null });
  });

  it('treats a token with no user as no session', () => {
    localStorage.setItem('t', 'a-token');

    expect(readSession('t', 'u')).toEqual({ token: null, user: null });
  });

  it('is empty when nothing is stored', () => {
    expect(readSession('t', 'u')).toEqual({ token: null, user: null });
  });
});
