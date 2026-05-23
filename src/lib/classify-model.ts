export function classifyModel(model: string | null): "local" | "openai" | "unknown" {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (/hermes|llama|qwen|mistral|gemma|deepseek|phi/.test(m)) return "local";
  if (/gpt|o1|o3|o4|openai/.test(m)) return "openai";
  return "unknown";
}
