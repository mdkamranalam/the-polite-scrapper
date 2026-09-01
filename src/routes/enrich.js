import express from "express";
import { EnrichInputSchema, STUB_ENRICH_RESPONSE } from "../llm/schema.js";
import { callEnrichModel } from "../llm/enricher.js";

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

  // 3. Stage 2: Call real model with prompt v1 and return raw model response text
  try {
    const result = await callEnrichModel(inputData);
    return res.status(200).send(result.rawText);
  } catch (error) {
    console.error("[Enrich LLM Error]:", error);
    return res.status(500).json({
      error: "LLM Call Failed",
      message: error.message,
    });
  }
});

