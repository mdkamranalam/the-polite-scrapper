import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichBookRecord, PROMPT_VERSION } from "../src/llm/enricher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CASES_FILE = path.join(__dirname, "cases.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runEvaluations() {
  console.log("=================================================");
  console.log(` Starting LLM Evaluation Suite (Prompt: ${PROMPT_VERSION})`);
  console.log(` Model: ${process.env.LLM_MODEL || "openrouter/free"}`);
  console.log("=================================================\n");

  const rawCases = await fs.readFile(CASES_FILE, "utf-8");
  const cases = JSON.parse(rawCases);

  let passedCategories = 0;
  let passedAudiences = 0;
  const failedCases = [];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalDurationMs = 0;

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    console.log(`[Case ${i + 1}/${cases.length}] Evaluating "${testCase.input.title}" (${testCase.description})...`);

    const start = Date.now();
    const result = await enrichBookRecord(testCase.input);
    const duration = Date.now() - start;
    totalDurationMs += duration;

    if (!result.success) {
      console.log(`  ❌ Failed execution: ${result.message}`);
      failedCases.push({
        id: testCase.id,
        title: testCase.input.title,
        expected_category: testCase.expected.category,
        actual: "ERROR: " + result.message,
      });
      continue;
    }

    if (result.tokens) {
      totalInputTokens += result.tokens.input;
      totalOutputTokens += result.tokens.output;
    }

    const actualCategory = result.data.category;
    const expectedCategory = testCase.expected.category;
    const categoryMatched = actualCategory === expectedCategory;

    const actualAudience = result.data.target_audience;
    const expectedAudience = testCase.expected.target_audience;
    const audienceMatched = actualAudience === expectedAudience;

    if (categoryMatched) {
      passedCategories++;
      console.log(`  ✔ Category: ${actualCategory} (Matched) | Confidence: ${result.data.confidence}`);
    } else {
      console.log(`  ✖ Category: ${actualCategory} (Expected: ${expectedCategory})`);
      failedCases.push({
        id: testCase.id,
        title: testCase.input.title,
        expected_category: expectedCategory,
        actual_category: actualCategory,
        summary: result.data.summary,
      });
    }

    if (audienceMatched) {
      passedAudiences++;
    }

    // Small delay between calls to be polite to free tier rate limits
    if (i < cases.length - 1) {
      await sleep(1500);
    }
  }

  const categoryScorePct = ((passedCategories / cases.length) * 100).toFixed(1);
  const audienceScorePct = ((passedAudiences / cases.length) * 100).toFixed(1);
  const avgDuration = (totalDurationMs / cases.length).toFixed(0);

  console.log("\n=================================================");
  console.log(" EVALUATION SUMMARY");
  console.log("=================================================");
  console.log(`Total Cases:           ${cases.length}`);
  console.log(`Category Accuracy:     ${passedCategories}/${cases.length} (${categoryScorePct}%)`);
  console.log(`Audience Accuracy:     ${passedAudiences}/${cases.length} (${audienceScorePct}%)`);
  console.log(`Avg Duration / Call:   ${avgDuration} ms`);
  console.log(`Total Tokens Used:     ${totalInputTokens} input, ${totalOutputTokens} output`);
  console.log("=================================================");

  if (failedCases.length > 0) {
    console.log("\nFailed Cases:");
    console.log(JSON.stringify(failedCases, null, 2));
  } else {
    console.log("\n🎉 All 8 evaluation test cases matched successfully!");
  }

  return {
    prompt_version: PROMPT_VERSION,
    total_cases: cases.length,
    passed_categories: passedCategories,
    category_pct: `${categoryScorePct}%`,
    passed_audiences: passedAudiences,
    audience_pct: `${audienceScorePct}%`,
    total_tokens: { input: totalInputTokens, output: totalOutputTokens },
    failed_cases: failedCases,
  };
}

runEvaluations().catch((err) => {
  console.error("Evaluation run error:", err);
  process.exit(1);
});
