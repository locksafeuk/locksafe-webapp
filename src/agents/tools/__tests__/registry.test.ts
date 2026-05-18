import {
  initializeTools,
  generateFunctionDefinitions,
  validateFunctionDefinitions,
} from "@/agents/tools";

describe("agent tool function schema generation", () => {
  beforeAll(() => {
    initializeTools();
  });

  it("generates valid array schemas for OpenAI function definitions", () => {
    const defs = generateFunctionDefinitions(["*"]);
    const errors = validateFunctionDefinitions(defs);

    expect(errors).toEqual([]);

    for (const def of defs) {
      for (const [, schema] of Object.entries(def.function.parameters.properties)) {
        if (!schema || typeof schema !== "object") {
          continue;
        }

        const typedSchema = schema as Record<string, unknown>;
        if (typedSchema.type === "array") {
          const items = typedSchema.items as Record<string, unknown> | undefined;
          expect(items).toBeDefined();
          expect(typeof items?.type).toBe("string");
          expect((items?.type as string).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps createGoogleAdsDraft competitorBrands as string array", () => {
    const defs = generateFunctionDefinitions(["cmo"]);
    const createGoogleAdsDraft = defs.find((d) => d.function.name === "createGoogleAdsDraft");

    expect(createGoogleAdsDraft).toBeDefined();

    const properties = createGoogleAdsDraft?.function.parameters.properties ?? {};
    const competitorBrands = properties.competitorBrands as Record<string, unknown> | undefined;

    expect(competitorBrands?.type).toBe("array");
    expect((competitorBrands?.items as Record<string, unknown>)?.type).toBe("string");
  });

  it("exposes repair tools to ceo but not cmo", () => {
    const ceoDefs = generateFunctionDefinitions(["ceo"]);
    const cmoDefs = generateFunctionDefinitions(["cmo"]);

    expect(ceoDefs.some((d) => d.function.name === "createRepairTask")).toBe(true);
    expect(ceoDefs.some((d) => d.function.name === "controlAgentHeartbeat")).toBe(true);

    expect(cmoDefs.some((d) => d.function.name === "createRepairTask")).toBe(false);
    expect(cmoDefs.some((d) => d.function.name === "controlAgentHeartbeat")).toBe(false);
  });
});
