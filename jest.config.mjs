// Jest config in native ESM (.mjs) so `import.meta.url` is honoured by Node
// directly without going through ts-node. The previous jest.config.ts failed
// in CI with `TS1343: The 'import.meta' meta-property is only allowed when
// the '--module' option is 'es2020'…` because ts-node compiled the config
// with an older module target before Node could load it. Plain ESM JS avoids
// that whole compile pass.

import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
  transform: {
    // Jest 30 enforces absolute-path resolution for transform modules — the
    // bare "ts-jest" string fails with "Module ts-jest in the transform
    // option was not found" even when ts-jest is installed. Resolving
    // explicitly to the absolute path keeps the config portable across
    // both Jest 29 and Jest 30.
    "^.+\\.(ts|tsx)$": [
      requireFromHere.resolve("ts-jest"),
      {
        tsconfig: "tsconfig.json",
        jsx: "react-jsx",
        jsxImportSource: "react",
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.ts",
    "^same-runtime/dist/jsx-runtime$": "react/jsx-runtime",
    "^same-runtime/dist/jsx-dev-runtime$": "react/jsx-dev-runtime",
    "^same-runtime(.*)$": "<rootDir>/src/__mocks__/sameRuntimeMock.ts",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(lucide-react|same-runtime)/)",
  ],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    "!src/**/*.stories.{ts,tsx}",
  ],
  forceExit: true,
};

export default config;
