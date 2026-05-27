/**
 * Shim for the `server-only` Next.js guard package.
 *
 * When running outside Next.js (tsx, PM2, scripts), the real `server-only`
 * package always throws:
 *   "This module cannot be imported from a Client Component module."
 *
 * This preload intercepts the require before the real package loads and
 * returns a silent no-op instead — safe because the guard only exists to
 * enforce Next.js build-time boundaries, which don't apply here.
 *
 * Loaded via NODE_OPTIONS='--require ./scripts/mock-server-only.cjs'
 * set in ecosystem.config.js.
 */

const Module = require("module");
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === "server-only") {
    return {}; // silent no-op — no throw outside Next.js
  }
  return originalLoad.apply(this, arguments);
};
