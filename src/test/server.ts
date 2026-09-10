import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * One server for the whole run. A test that needs a different answer overrides a single
 * route with `server.use(...)`, and the reset between tests puts the default back.
 */
export const server = setupServer(...handlers);
