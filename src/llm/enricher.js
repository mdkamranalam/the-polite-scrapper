import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { EnrichOutputSchema } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __dirname is .../scraper/src/llm -> project root is path.join(__dirname, "..", "..")
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

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

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
    const logLine = JSON.stringify({
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
 * Calls model and validates output against EnrichOutputSchema.
 * If invalid or unparseable, performs exactly ONE repair retry.
 * If repair fails, logs to quarantine.jsonl and returns { success: false, error, status: 422 }.
 */
export async function enrichBookRecord(inputData) {
  const systemPrompt = await getSystemPrompt();

  const userPayloadString = JSON.stringify(inputData);

  // --- ATTEMPT 1 ---
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPayloadString },
  ];

  let rawOutput1 = "";
  let modelName = process.env.LLM_MODEL || "openrouter/free";
  let usage = null;

  try {
    const res1 = await client.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      messages,
    });

    rawOutput1 = res1.choices[0]?.message?.content || "";
    usage = res1.usage;
    modelName = res1.model || modelName;

    // Parse JSON
    const parsedJson1 = extractJsonFromText(rawOutput1);

    // Validate with Zod safeParse
    const validation1 = EnrichOutputSchema.safeParse(parsedJson1);
    if (validation1.success) {
      return {
        success: true,
        data: validation1.data,
        attempts: 1,
        model: modelName,
        usage,
      };
    }

    // Validation failed on Attempt 1 -> Prepare Repair Retry
    const validationErrors1 = validation1.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

    // --- ATTEMPT 2: Repair Retry ---
    const repairPrompt = `Your previous answer was rejected for this reason: ${validationErrors1}.
Previous output was:
${rawOutput1}

Return ONLY corrected JSON matching the schema precisely. No extra text.`;

    const repairMessages = [
      ...messages,
      { role: "assistant", content: rawOutput1 },
      { role: "user", content: repairPrompt },
    ];

    const res2 = await client.chat.completions.create({
      model: modelName,
      temperature: 0.1,
      messages: repairMessages,
    });

    const rawOutput2 = res2.choices[0]?.message?.content || "";

    const parsedJson2 = extractJsonFromText(rawOutput2);
    const validation2 = EnrichOutputSchema.safeParse(parsedJson2);

    if (validation2.success) {
      return {
        success: true,
        data: validation2.data,
        attempts: 2,
        repaired: true,
        model: modelName,
        usage: res2.usage || usage,
      };
    }

    // Attempt 2 failed validation as well
    const validationErrors2 = validation2.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

    await logToQuarantine({
      input: inputData,
      raw_output_attempt_1: rawOutput1,
      raw_output_attempt_2: rawOutput2,
      error: `Validation failed after repair: ${validationErrors2}`,
    });

    return {
      success: false,
      status: 422,
      error: "Unprocessable Entity",
      message: `Model output failed schema validation after repair attempt: ${validationErrors2}`,
    };
  } catch (err) {
    // Parse error on attempt 1 or network error
    if (rawOutput1 && !err.repairedAttempted) {
      // Attempt repair for raw parsing failure
      try {
        const repairPrompt = `Your previous answer could not be parsed as valid JSON. Error: ${err.message}.
Previous output was:
${rawOutput1}

Return ONLY valid, raw JSON matching the schema. No markdown formatting.`;

        const repairMessages = [
          ...messages,
          { role: "assistant", content: rawOutput1 },
          { role: "user", content: repairPrompt },
        ];

        const res2 = await client.chat.completions.create({
          model: modelName,
          temperature: 0.1,
          messages: repairMessages,
        });

        const rawOutput2 = res2.choices[0]?.message?.content || "";
        const parsedJson2 = extractJsonFromText(rawOutput2);
        const validation2 = EnrichOutputSchema.safeParse(parsedJson2);

        if (validation2.success) {
          return {
            success: true,
            data: validation2.data,
            attempts: 2,
            repaired: true,
            model: modelName,
            usage: res2.usage || usage,
          };
        }

        await logToQuarantine({
          input: inputData,
          raw_output_attempt_1: rawOutput1,
          raw_output_attempt_2: rawOutput2,
          error: "JSON parse failed on attempt 1, schema validation failed on attempt 2",
        });

        return {
          success: false,
          status: 422,
          error: "Unprocessable Entity",
          message: "Model output failed schema validation after repair.",
        };
      } catch (repairErr) {
        await logToQuarantine({
          input: inputData,
          raw_output_attempt_1: rawOutput1,
          error: `Parsing failed on both attempts: ${repairErr.message}`,
        });

        return {
          success: false,
          status: 422,
          error: "Unprocessable Entity",
          message: "Model output could not be parsed as valid JSON after repair.",
        };
      }
    }

    // General failure
    return {
      success: false,
      status: 500,
      error: "LLM Execution Error",
      message: err.message,
    };
  }
}
