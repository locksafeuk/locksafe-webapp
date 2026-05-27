import { getOllamaRuntimeDecision, isOllamaRuntimeEnabled } from "../ollama-runtime";

describe("ollama runtime decision", () => {
  it("keeps Ollama enabled in Vercel when endpoint is ts.net unless explicitly disabled", () => {
    const decision = getOllamaRuntimeDecision({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(true);
    expect(decision.reason).toBeUndefined();
    expect(isOllamaRuntimeEnabled({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
    } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("honors explicit runtime disable override", () => {
    const decision = getOllamaRuntimeDecision({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
      OLLAMA_RUNTIME_ENABLED: "false",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toMatch(/OLLAMA_RUNTIME_ENABLED=false/i);
  });

  it("keeps Ollama enabled for local runtimes", () => {
    const decision = getOllamaRuntimeDecision({
      OLLAMA_BASE_URL: "http://localhost:11434",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(true);
  });

  it("disables Ollama on serverless when endpoint is localhost → routes to OpenAI", () => {
    const decision = getOllamaRuntimeDecision({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "http://localhost:11434",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toMatch(/serverless/i);
  });

  it("disables Ollama on serverless when no base URL is set → routes to OpenAI", () => {
    const decision = getOllamaRuntimeDecision({
      VERCEL: "1",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(false);
  });
});