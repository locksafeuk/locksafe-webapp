import type { Config } from "jest";

const config: Config = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
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
};

export default config;
