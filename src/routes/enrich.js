import express from "express";
import { EnrichInputSchema, STUB_ENRICH_RESPONSE } from "../llm/schema.js";

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

  // Model call logic will be connected in Stages 2 & 3
  return res.status(501).json({
    error: "Not Implemented",
    message: "LLM integration will be active in Stage 2/3. Use LLM_STUB=1 for stub mode.",
  });
});
