/**
 * LLM Router
 *
 * Routes AI generation requests to the best available provider:
 *   1. Ollama (local) — if OLLAMA_BASE_URL is set and reachable
 *   2. OpenAI (cloud)  — fallback for Vercel/production
 *
 * Usage: drop-in replacement for openai.chat.completions.create()
 *
 *   import { createCompletion } from '@/lib/llm-router';
 *   const response = await createCompletion({ messages, temperature, ... });
 *   const text = response.choices[0].message.content;
 */

import OpenAI from 'openai';

// ─── Config ──────────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL; // e.g. http://localhost:11434
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL ?? 'qwen2.5:72b';
const OLLAMA_TIMEOUT  = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);

// ─── Clients ─────────────────────────────────────────────────────────────────

// Standard OpenAI client (cloud)
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ollama exposes an OpenAI-compatible /v1 endpoint
function getOllamaClient(): OpenAI {
  return new OpenAI({
    baseURL: `${OLLAMA_BASE_URL}/v1`,
    apiKey:  'ollama',      // required by SDK but not validated by Ollama
    timeout: OLLAMA_TIMEOUT,
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type LLMProvider = 'ollama' | 'openai';

export interface LLMResponse {
  choices: Array<{ message: { content: string | null } }>;
  provider: LLMProvider;
  model: string;
}

type CompletionParams = Parameters<typeof openaiClient.chat.completions.create>[0];

// ─── Core router ─────────────────────────────────────────────────────────────

/**
 * Route a chat completion to Ollama (if available) or OpenAI.
 * Strips `response_format` from Ollama calls unless the model supports it.
 */
export async function createCompletion(
  params: Omit<CompletionParams, 'stream'>
): Promise<LLMResponse> {
  // ── Try Ollama first ───────────────────────────────────────────────────────
  if (OLLAMA_BASE_URL) {
    try {
      const client = getOllamaClient();

      // qwen2.5 supports json_object; pass through response_format as-is.
      // For other models that may not, we could strip it here — but for now
      // OLLAMA_MODEL is assumed to be qwen2.5:72b.
      const response = await (client.chat.completions.create as (
        p: CompletionParams
      ) => Promise<OpenAI.Chat.Completions.ChatCompletion>)({
        ...params,
        model: OLLAMA_MODEL,
        stream: false,
      });

      const content = response.choices[0]?.message?.content ?? '';
      console.log(`[LLM Router] Ollama ✓  model=${OLLAMA_MODEL}`);
      return {
        choices: [{ message: { content } }],
        provider: 'ollama',
        model: OLLAMA_MODEL,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM Router] Ollama failed (${msg}) — falling back to OpenAI`);
    }
  }

  // ── OpenAI fallback ────────────────────────────────────────────────────────
  const model = (params as CompletionParams & { model?: string }).model ?? 'gpt-4o';
  const response = await (openaiClient.chat.completions.create as (
    p: CompletionParams
  ) => Promise<OpenAI.Chat.Completions.ChatCompletion>)({
    ...params,
    model,
    stream: false,
  });

  const content = response.choices[0]?.message?.content ?? '';
  console.log(`[LLM Router] OpenAI ✓  model=${model}`);
  return {
    choices: [{ message: { content } }],
    provider: 'openai',
    model,
  };
}
