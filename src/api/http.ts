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
