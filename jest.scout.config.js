// Dedicated config for opportunity-scout tests
// Uses resolved path to avoid Jest 30 transform resolution issue
const path = require('path');
const tsJest = require.resolve('ts-jest');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/opportunity-scout.test.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      tsJest,
      {
        tsconfig: {
          strict: false,
          esModuleInterop: true,
          moduleResolution: "node",
          module: "commonjs",
          target: "ES2020",
          jsx: "react-jsx",
          jsxImportSource: "react",
        },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.ts",
  },
  transformIgnorePatterns: ["/node_modules/"],
  forceExit: true,
  testTimeout: 15000,
};
