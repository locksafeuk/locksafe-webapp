import { getOllamaRuntimeDecision, isOllamaRuntimeEnabled } from "../ollama-runtime";

describe("ollama runtime decision", () => {
  it("disables Ollama in Vercel when the endpoint is a ts.net host", () => {
    const decision = getOllamaRuntimeDecision({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(false);
    expect(decision.reason).toMatch(/Tailscale ts.net/i);
    expect(isOllamaRuntimeEnabled({
      VERCEL: "1",
      VERCEL_ENV: "production",
      OLLAMA_BASE_URL: "https://alexandrus-mac-studio.tail88d9cc.ts.net",
    } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it("keeps Ollama enabled for local runtimes", () => {
    const decision = getOllamaRuntimeDecision({
      OLLAMA_BASE_URL: "http://localhost:11434",
    } as unknown as NodeJS.ProcessEnv);

    expect(decision.enabled).toBe(true);
  });
});