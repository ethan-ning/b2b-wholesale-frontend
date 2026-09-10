import { describe, expect, it } from 'vitest';
import { apiErrorMessage, authFailureMessage } from './http';

/**
 * Sign-in used to answer every failure with "Invalid email or password." That is true for
 * exactly one of them, and on the day it was fixed it had been wrong three times in a
 * row — a CORS rejection, a stopped backend, and a password that was correct all along.
 * Each cost real time, because the message pointed at the one thing that was fine.
 *
 * So the rule these lock in is narrow: only a 401 may blame the credentials.
 */
const WRONG = 'Invalid email or password.';

const withStatus = (status: number, message?: string) => ({
  response: { status, data: message ? { message } : undefined },
});

describe('authFailureMessage', () => {
  it('blames the credentials on 401, and only on 401', () => {
    expect(authFailureMessage(withStatus(401), WRONG)).toBe(WRONG);
  });

  it('prefers what the server actually said', () => {
    expect(authFailureMessage(withStatus(401, 'Current password is incorrect'), WRONG))
      .toBe('Current password is incorrect');
  });

  it('calls a 403 a configuration problem, not a wrong password', () => {
    const message = authFailureMessage(withStatus(403), WRONG);

    expect(message).toMatch(/configuration/i);
    expect(message).not.toBe(WRONG);
  });

  it('says the server is not responding on a gateway status', () => {
    // The dev proxy answers 502 when the backend is stopped, which is how an afternoon
    // went into a password that was never wrong.
    for (const status of [502, 503, 504]) {
      expect(authFailureMessage(withStatus(status), WRONG)).toMatch(/not responding/i);
    }
  });

  it('distinguishes a server that broke from one that is absent', () => {
    expect(authFailureMessage(withStatus(500), WRONG)).toMatch(/had a problem/i);
  });

  it('reports an unreachable server when there was no response at all', () => {
    expect(authFailureMessage({}, WRONG)).toMatch(/could not reach/i);
  });

  it('names a timeout as a timeout', () => {
    expect(authFailureMessage({ code: 'ECONNABORTED' }, WRONG)).toMatch(/too long/i);
  });

  it('mentions rate limiting on 429', () => {
    expect(authFailureMessage(withStatus(429), WRONG)).toMatch(/too many/i);
  });

  it('falls back for a status it has no opinion about', () => {
    expect(authFailureMessage(withStatus(418), WRONG)).toBe(WRONG);
  });
});

describe('apiErrorMessage', () => {
  it('surfaces the API message verbatim', () => {
    expect(apiErrorMessage(withStatus(409, 'A sync is already running'), 'fallback'))
      .toBe('A sync is already running');
  });

  it('falls back when the API said nothing useful', () => {
    expect(apiErrorMessage(withStatus(409, '   '), 'fallback')).toBe('fallback');
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
