import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createChatCompletionWithPolicy } from "./client.js";
import { EnrichOutputSchema } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const PROMPT_PATH = path.join(PROJECT_ROOT, "prompts", "enrich-v1.md");
export const LOGS_DIR = path.join(PROJECT_ROOT, "logs");
export const QUARANTINE_PATH = path.join(LOGS_DIR, "quarantine.jsonl");

export const PROMPT_VERSION = "enrich-v1";

let cachedSystemPrompt = null;

export async function getSystemPrompt() {
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = await fs.readFile(PROMPT_PATH, "utf-8");
  }
  return cachedSystemPrompt;
}

/**
 * Strips markdown code fences (e.g. ```json ... ```) or prefix text to locate the JSON payload.
 */
export function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty or non-string response from model");
  }

  let cleaned = rawText.trim();

  // Strip code block fences
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(fenceRegex);
  if (match && match[1]) {
    cleaned = match[1].trim();
  }

  // Find first '{' and last '}'
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Appends unrepairable schema failures to logs/quarantine.jsonl
 */
export async function logToQuarantine(entry) {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    const logLine =
      JSON.stringify({
        timestamp: new Date().toISOString(),
        prompt_version: PROMPT_VERSION,
        ...entry,
      }) + "\n";
    await fs.appendFile(QUARANTINE_PATH, logLine, "utf-8");
  } catch (err) {
    console.error("[Quarantine Log Error]:", err.message);
  }
}

/**
 * Emits a structured log line for every call tracking cost, tokens, duration, and repair count
 */
function logCallCost({
  promptVersion,
  model,
  inputTokens,
  outputTokens,
  durationMs,
  repaired,
  success,
}) {
  const logEntry = {
    event: "llm_call_cost",
    timestamp: new Date().toISOString(),
    prompt_version: promptVersion,
    model,
    input_tokens: inputTokens ?? 0,
    output_tokens: outputTokens ?? 0,
    total_tokens: (inputTokens ?? 0) + (outputTokens ?? 0),
    duration_ms: durationMs,
    repaired: repaired,
    success,
  };
  // Twelve-factor stdout logging
  console.log(JSON.stringify(logEntry));
}

/**
 * Calls model and validates output against EnrichOutputSchema.
 * Uses custom retry policy with exponential backoff & jitter, explicit 30s timeout,
 * single repair retry on validation failure, and structured token/cost logging.
 */
export async function enrichBookRecord(inputData) {
  const startTime = Date.now();
  const systemPrompt = await getSystemPrompt();
  const userPayloadString = JSON.stringify(inputData);

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPayloadString },
  ];

  let rawOutput1 = "";
  let modelName = process.env.LLM_MODEL || "openrouter/free";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // --- ATTEMPT 1 ---
    const res1 = await createChatCompletionWithPolicy({
      model: modelName,
      temperature: 0.1,
      messages,
    });

    rawOutput1 = res1.choices[0]?.message?.content || "";
    modelName = res1.model || modelName;
    totalInputTokens += res1.usage?.prompt_tokens || 0;
    totalOutputTokens += res1.usage?.completion_tokens || 0;

    let parsedJson1;
    let parseFailed = false;
    try {
      parsedJson1 = extractJsonFromText(rawOutput1);
    } catch (parseErr) {
      parseFailed = true;
    }

    if (!parseFailed) {
      const validation1 = EnrichOutputSchema.safeParse(parsedJson1);
      if (validation1.success) {
        const durationMs = Date.now() - startTime;
        logCallCost({
          promptVersion: PROMPT_VERSION,
          model: modelName,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          durationMs,
          repaired: false,
          success: true,
        });

        return {
          success: true,
          data: validation1.data,
          attempts: 1,
          model: modelName,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
        };
      }
    }

    // Validation or Parse failed on Attempt 1 -> Perform ONE Repair Retry
    const reason = parseFailed
      ? "Invalid JSON format"
      : "Schema validation errors";

    const repairPrompt = `Your previous answer was rejected for this reason: ${reason}.
Previous output was:
${rawOutput1}

Return ONLY corrected JSON matching the schema precisely. No extra text or markdown formatting.`;

    const repairMessages = [
      ...messages,
      { role: "assistant", content: rawOutput1 },
      { role: "user", content: repairPrompt },
    ];

    const res2 = await createChatCompletionWithPolicy({
      model: modelName,
      temperature: 0.1,
      messages: repairMessages,
    });

    const rawOutput2 = res2.choices[0]?.message?.content || "";
    totalInputTokens += res2.usage?.prompt_tokens || 0;
    totalOutputTokens += res2.usage?.completion_tokens || 0;

    try {
      const parsedJson2 = extractJsonFromText(rawOutput2);
      const validation2 = EnrichOutputSchema.safeParse(parsedJson2);

      if (validation2.success) {
        const durationMs = Date.now() - startTime;
        logCallCost({
          promptVersion: PROMPT_VERSION,
          model: modelName,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          durationMs,
          repaired: true,
          success: true,
        });

        return {
          success: true,
          data: validation2.data,
          attempts: 2,
          repaired: true,
          model: modelName,
          tokens: { input: totalInputTokens, output: totalOutputTokens },
        };
      }
    } catch (_) {
      // Ignored, handled in quarantine logging below
    }

    // Both attempts failed -> Quarantine & 422
    const durationMs = Date.now() - startTime;
    logCallCost({
      promptVersion: PROMPT_VERSION,
      model: modelName,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs,
      repaired: true,
      success: false,
    });

    await logToQuarantine({
      input: inputData,
      raw_output_attempt_1: rawOutput1,
      error: "Model output failed schema validation after 1 repair retry",
    });

    return {
      success: false,
      status: 422,
      error: "Unprocessable Entity",
      message: "Model output failed schema validation after repair attempt.",
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    logCallCost({
      promptVersion: PROMPT_VERSION,
      model: modelName,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs,
      repaired: false,
      success: false,
    });

    const status = err.status || 500;
    return {
      success: false,
      status,
      error: status === 504 ? "Gateway Timeout" : "LLM Execution Error",
      message: err.message,
    };
  }
}
