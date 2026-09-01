import { z } from "zod";

// --- Closed Lists / Enums as per JOB-CARD.md ---
export const CategoryEnum = z.enum([
  "fiction",
  "non_fiction",
  "sci_fi_fantasy",
  "mystery_thriller",
  "history_biography",
  "romance",
  "children",
  "other",
]);

export const TargetAudienceEnum = z.enum([
  "general",
  "adult",
  "young_adult",
  "children",
]);

// --- Request Input Validation Schema ---
export const EnrichInputSchema = z.object({
  title: z
    .string({
      required_error: "field 'title' is required",
      invalid_type_error: "field 'title' must be a string",
    })
    .min(1, "field 'title' must not be empty")
    .max(300, "field 'title' must be at most 300 characters"),
  description: z
    .string({
      required_error: "field 'description' is required",
      invalid_type_error: "field 'description' must be a string",
    })
    .min(1, "field 'description' must not be empty")
    .max(5000, "field 'description' must be at most 5000 characters"),
  price: z
    .number({
      invalid_type_error: "field 'price' must be a number",
    })
    .nonnegative("field 'price' must be non-negative")
    .optional(),
});

// --- Output Schema (Expected from LLM and returned by API) ---
export const EnrichOutputSchema = z.object({
  category: CategoryEnum,
  target_audience: TargetAudienceEnum,
  summary: z
    .string()
    .min(1, "field 'summary' cannot be empty")
    .max(200, "field 'summary' must be at most 200 characters"),
  confidence: z
    .number()
    .min(0.0, "confidence must be between 0.0 and 1.0")
    .max(1.0, "confidence must be between 0.0 and 1.0"),
  quality_flags: z.array(z.string()),
});

// Hardcoded stub response satisfying EnrichOutputSchema
export const STUB_ENRICH_RESPONSE = {
  category: "fiction",
  target_audience: "general",
  summary: "A stubbed book summary returned in development mode without invoking any LLM calls.",
  confidence: 0.95,
  quality_flags: ["clean"],
};
