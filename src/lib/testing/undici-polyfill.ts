/**
 * Side-effect polyfill for Jest's jsdom environment.
 *
 * Provides global Request / Response / Headers so importing
 * `next/server` doesn't throw "ReferenceError: Request is not defined"
 * at module-load. Import this BEFORE any module that transitively
 * loads `next/server`:
 *
 *   import "@/lib/testing/undici-polyfill";
 *   import { POST } from "@/app/api/marketing/call-intent/route";
 *
 * ES module evaluation order is source-order for imports, so putting
 * this polyfill import first guarantees the globals exist before
 * next/server is evaluated.
 *
 * NOT a test file — lives outside __tests__ so Jest's testMatch
 * doesn't try to discover tests inside it.
 */
import { Request as UndiciRequest, Response as UndiciResponse, Headers as UndiciHeaders } from "undici";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (typeof g.Request  === "undefined") g.Request  = UndiciRequest;
if (typeof g.Response === "undefined") g.Response = UndiciResponse;
if (typeof g.Headers  === "undefined") g.Headers  = UndiciHeaders;
