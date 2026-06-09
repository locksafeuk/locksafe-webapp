import "@testing-library/jest-dom";

// CI runners (esp. GitHub Actions free tier) are noticeably slower than
// local dev machines. Tests that exercise cron routes with fetch mocks and
// fake timers were tripping the default 5s timeout. 15s gives headroom
// without masking genuinely-hung tests.
jest.setTimeout(15000);
