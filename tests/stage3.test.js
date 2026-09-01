import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractJsonFromText, logToQuarantine, QUARANTINE_PATH } from "../src/llm/enricher.js";
import { EnrichOutputSchema } from "../src/llm/schema.js";

const QUARANTINE_FILE = QUARANTINE_PATH;

async function runTests() {
  console.log("Running Stage 3 validation and repair unit tests...");

  // 1. Test extractJsonFromText with markdown fences and prefix text
  const fencedText = "Sure! Here is the JSON you requested:\n```json\n{\n  \"category\": \"fiction\",\n  \"target_audience\": \"general\",\n  \"summary\": \"Test summary\",\n  \"confidence\": 0.9,\n  \"quality_flags\": [\"clean\"]\n}\n```\nHope that helps!";
  const extracted = extractJsonFromText(fencedText);
  assert.strictEqual(extracted.category, "fiction");
  console.log("✔ extractJsonFromText correctly strips markdown fences and conversational wrappers");

  // 2. Test schema validation passes for valid object
  const validCheck = EnrichOutputSchema.safeParse(extracted);
  assert.strictEqual(validCheck.success, true);
  console.log("✔ Zod EnrichOutputSchema accepts valid response");

  // 3. Test schema validation rejects invalid enum category
  const invalidObj = {
    category: "invalid_alien_genre",
    target_audience: "general",
    summary: "Test summary",
    confidence: 0.9,
    quality_flags: ["clean"],
  };
  const invalidCheck = EnrichOutputSchema.safeParse(invalidObj);
  assert.strictEqual(invalidCheck.success, false);
  console.log("✔ Zod EnrichOutputSchema strictly rejects unauthorized enum categories");

  // 4. Test logToQuarantine writes structured line
  await logToQuarantine({
    input: { title: "Test Book", description: "Test" },
    raw_output: JSON.stringify(invalidObj),
    error: "Validation failed: invalid enum category",
  });

  const content = await fs.readFile(QUARANTINE_FILE, "utf-8");
  assert.ok(content.includes("invalid_alien_genre"));
  console.log("✔ Quarantine logger successfully appends failed outputs to logs/quarantine.jsonl");

  console.log("\nAll Stage 3 tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
