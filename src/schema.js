import { z } from "zod";

/**
 * Normalizes price string like "£51.77" or "51.77" into numeric float 51.77.
 * @param {string|null|undefined} priceText
 * @returns {number}
 */
export function normalizePrice(priceText) {
  if (!priceText || typeof priceText !== "string") {
    throw new Error(`Invalid priceText: "${priceText}"`);
  }
  const match = priceText.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`Could not parse numeric price from "${priceText}"`);
  }
  return parseFloat(match[1]);
}

/**
 * Strict Zod schema for a validated Book Record.
 */
export const BookRecordSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  product_url: z
    .string()
    .url("Must be a valid URL")
    .startsWith("https://", "URL must start with https://"),
  price_text: z.string().min(1, "price_text is required"),
  price_gbp: z.number().nonnegative("price_gbp must be a non-negative number"),
  availability_text: z.string().min(1, "availability_text is required"),
  rating_text: z.string().min(1, "rating_text is required"),
  description: z.string().nullable(), // Optional/nullable description
  source_page: z
    .string()
    .url("Must be a valid URL")
    .startsWith("https://", "source_page must start with https://"),
  fetched_at: z.string().datetime({ message: "Must be a valid ISO 8601 UTC timestamp" }),
});

/**
 * Normalizes and validates a raw record.
 * @param {Object} rawRecord
 * @returns {{ success: boolean, data?: z.infer<typeof BookRecordSchema>, error?: string }}
 */
export function normalizeAndValidateRecord(rawRecord) {
  try {
    const price_gbp = normalizePrice(rawRecord.price_text);
    const normalized = {
      ...rawRecord,
      price_gbp,
    };
    const validated = BookRecordSchema.parse(normalized);
    return { success: true, data: validated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof z.ZodError ? err.issues : err.message,
    };
  }
}
