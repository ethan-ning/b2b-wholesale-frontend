/*
 * React's scheduler captures its transport when it loads: `setImmediate` if that global
 * exists, otherwise a `MessageChannel`. A setImmediate callback belongs to Node and
 * outlives the test environment being disposed, so it runs with no `window` and fails the
 * run as an uncaught error while every test passes. A MessageChannel is created inside the
 * environment and dies with it.
 *
 * Its own file, listed first in setupFiles, because import declarations are hoisted — as a
 * statement inside setup.ts this would run after that file's imports had already pulled in
 * react-dom, which is the moment the choice is made.
 */
delete (globalThis as { setImmediate?: unknown }).setImmediate;
