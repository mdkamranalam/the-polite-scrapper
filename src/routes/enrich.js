import express from "express";
import { EnrichInputSchema, STUB_ENRICH_RESPONSE } from "../llm/schema.js";
import { enrichBookRecord } from "../llm/enricher.js";

export const enrichRouter = express.Router();

// Safe deterministic fallback object when kill switch is activated
export const KILL_SWITCH_FALLBACK = {
  category: "other",
  target_audience: "general",
  summary: "Service temporarily operating in fallback mode.",
  confidence: 0.0,
  quality_flags: ["kill_switch_active", "fallback_response"],
};

enrichRouter.post("/", async (req, res) => {
  // 1. Input Validation with Zod (Reject invalid before anything else happens)
  const parseResult = EnrichInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    const formattedErrors = parseResult.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));

    return res.status(400).json({
      error: "Bad Request",
      details: formattedErrors,
    });
  }

  const inputData = parseResult.data;

  // 2. Kill Switch: When LLM_ENABLED=false, bypass model calls and return safe deterministic fallback
  if (process.env.LLM_ENABLED === "false" || process.env.LLM_ENABLED === "0") {
    return res.status(200).json(KILL_SWITCH_FALLBACK);
  }

  // 3. Stub mode: When LLM_STUB=1 or true, skip LLM calls entirely and return hardcoded schema-valid object
  if (process.env.LLM_STUB === "1" || process.env.LLM_STUB === "true") {
    return res.status(200).json(STUB_ENRICH_RESPONSE);
  }

  // 4. Call LLM with Schema Validation, Single Repair Retry, Custom Backoff, and Cost Logging
  const result = await enrichBookRecord(inputData);

  if (result.success) {
    // Contract guarantee: Never emit raw model strings, always return validated JSON object
    return res.status(200).json(result.data);
  }

  // Error handling: Returns clean 422, 504 Gateway Timeout, or 500
  return res.status(result.status || 500).json({
    error: result.error,
    message: result.message,
  });
});
