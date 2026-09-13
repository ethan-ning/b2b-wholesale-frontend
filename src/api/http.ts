import axios, { type AxiosInstance } from 'axios';

/**
 * Base URL for every API call. Vite proxies this to the backend in dev; point VITE_API_BASE_URL at
 * the real service to run against it instead — no other code changes.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * The dealer and admin portals hold separate sessions, so each gets its own instance
 * with its own token and its own login page to bounce back to on 401.
 */
function createClient(tokenKey: string, userKey: string, loginPath: string): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = localStorage.getItem(tokenKey);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        window.location.href = loginPath;
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export const dealerClient = createClient('auth_token', 'auth_user', '/login');
export const adminClient = createClient('admin_token', 'admin_user', '/admin/login');

/**
 * What the API said went wrong, or [fallback] when it did not say.
 *
 * Worth surfacing verbatim: the refusals that reach a user name the thing they are about
 * — which SPU has no price, which sync is already running — and a generic message throws
 * that away. Lives here because this is where the response shape is already known; at the
 * call sites it was four copies of the same cast.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const said = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return said?.trim() || fallback;
}

interface FailureShape {
  code?: string;
  response?: { status?: number; data?: { message?: string } };
}

/**
 * Why a sign-in or password change failed, in the user's terms.
 *
 * Only a 401 is allowed to blame the credentials. A stopped backend and a CORS rejection
 * once reported themselves as a wrong password, which sent us hunting one that had been
 * correct all along.
 */
export function authFailureMessage(error: unknown, wrongCredentials: string): string {
  const failure = error as FailureShape;

  // No response at all — the request never reached the API.
  if (!failure?.response) {
    return failure?.code === 'ECONNABORTED'
      ? 'The server took too long to answer. Please try again.'
      : 'Could not reach the server. Check your connection and try again.';
  }

  const { status } = failure.response;
  const said = failure.response.data?.message?.trim();

  if (status === 401) return said || wrongCredentials;
  // Refused before the account was ever checked. A user cannot fix this one, and telling
  // them their password is wrong sends them somewhere there is nothing to find.
  if (status === 403) return 'The server rejected this request. This is a configuration problem, not a wrong password.';
  if (status === 404) return 'The sign-in service was not found. The server may be misconfigured.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  // Something in front of the API answered because the API did not — in dev, the Vite
  // proxy with the backend stopped.
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is not responding. It may be starting up or stopped.';
  }
  if (status && status >= 500) return 'The server had a problem. Please try again in a moment.';

  return said || wrongCredentials;
}

/**
 * For the login endpoints only: no token to attach, and deliberately no 401 redirect.
 *
 * A failed sign-in must reach the page so it can say "Invalid email or password". Sent
 * through one of the clients above, the interceptor would treat that 401 as an expired
 * session and navigate away before the page could render anything — an admin who mistyped
 * their password would land on the dealer login screen with no explanation.
 */
export const authClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});
