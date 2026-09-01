import express from "express";
import { EnrichInputSchema, STUB_ENRICH_RESPONSE } from "../llm/schema.js";
import { enrichBookRecord } from "../llm/enricher.js";

export const enrichRouter = express.Router();

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

  // 2. Stub mode: When LLM_STUB=1 or true, skip LLM calls entirely and return hardcoded schema-valid object
  if (process.env.LLM_STUB === "1" || process.env.LLM_STUB === "true") {
    return res.status(200).json(STUB_ENRICH_RESPONSE);
  }

  // 3. Call LLM with Schema Validation, Single Repair Retry, and Quarantine fallback
  const result = await enrichBookRecord(inputData);

  if (result.success) {
    // Contract guarantee: Never emit raw model strings, always return validated JSON object
    return res.status(200).json(result.data);
  }

  // Error handling: Returns clean 422 with validation explanation or 500
  return res.status(result.status || 500).json({
    error: result.error,
    message: result.message,
  });
});
