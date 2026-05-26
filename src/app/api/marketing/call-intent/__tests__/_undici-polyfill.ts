/**
 * DEPRECATED — this file remains only because the test sandbox couldn't
 * delete it. The polyfill approach was replaced by direct next/server
 * mocking in the test files that need it.
 *
 * Safe to delete manually:
 *   rm src/app/api/marketing/call-intent/__tests__/_undici-polyfill.ts
 *
 * Until then, ship a trivial no-op test so Jest's __tests__/ discovery
 * doesn't mark the suite as failed for having zero tests.
 */
describe("_undici-polyfill (deprecated stub)", () => {
  it("is a no-op placeholder — delete this file when convenient", () => {
    expect(true).toBe(true);
  });
});
