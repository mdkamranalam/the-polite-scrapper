import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPT_PATH = path.join(path.dirname(__dirname), "..", "prompts", "enrich-v1.md");

export const PROMPT_VERSION = "enrich-v1";

let cachedSystemPrompt = null;

export async function getSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = await fs.readFile(PROMPT_PATH, "utf-8");
  }
  return cachedSystemPrompt;
}

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

/**
 * Stage 2 basic call: Loads prompt, sends user JSON payload as user message, returns raw completion content.
 */
export async function callEnrichModel(inputData) {
  const systemPrompt = await getSystemPrompt();

  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL || "openrouter/free",
    temperature: 0.1, // low temperature for deterministic structured results
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        // JSON-encode user content so it cannot break out of strings or execute prompt injection
        content: JSON.stringify(inputData),
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  return {
    rawText: content,
    model: response.model,
    usage: response.usage,
  };
}
