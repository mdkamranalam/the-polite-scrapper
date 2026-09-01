import OpenAI from "openai";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses Retry-After header which can be either seconds (e.g. "5") or an HTTP Date string.
 */
function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const numeric = Number(headerValue);
  if (!Number.isNaN(numeric) && numeric >= 0) {
    return numeric * 1000;
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

/**
 * Creates OpenAI client with:
 * - maxRetries: 0 (Disabling SDK implicit retries to avoid unmanaged double calls)
 * - timeout: 30000 (30-second explicit client timeout)
 */
export const llmClient = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY || "dummy",
  timeout: 30000,
  maxRetries: 0, // Explicitly disable SDK retries in favor of our managed retry policy
});

/**
 * Custom retry wrapper with exponential backoff & jitter.
 * RETRY on:
 *   - 429 (Rate Limit) -> respects Retry-After header
 *   - 5xx (500, 502, 503, 504, 529 server overload)
 *   - Timeouts / network connection resets (APIConnectionTimeoutError, Request timeout)
 * NEVER RETRY on:
 *   - 400 (Bad Request), 401 (Unauthorized/Bad Key), 403 (Forbidden)
 */
export async function createChatCompletionWithPolicy(params, maxRetries = 2) {
  let attempt = 0;

  while (true) {
    try {
      attempt++;
      return await llmClient.chat.completions.create(params);
    } catch (err) {
      const status = err.status;
      const isTimeout =
        err.name === "APIConnectionTimeoutError" ||
        err.code === "ETIMEDOUT" ||
        err.type === "request_timeout" ||
        err.isTimeout ||
        err.message?.toLowerCase().includes("timed out") ||
        err.message?.toLowerCase().includes("timeout");

      // Check non-retryable 4xx client errors (400, 401, 403)
      if (status === 400 || status === 401 || status === 403) {
        // Fail fast immediately
        const error = new Error(`LLM Client Error [${status}]: ${err.message}`);
        error.status = status;
        error.originalError = err;
        throw error;
      }

      const isRetryable =
        isTimeout || status === 429 || (typeof status === "number" && status >= 500);

      if (isRetryable && attempt <= maxRetries) {
        let delayMs = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500; // 1s, 2s + jitter

        if (status === 429 && err.headers) {
          const retryAfterVal =
            err.headers.get?.("retry-after") || err.headers?.["retry-after"];
          const serverDelay = parseRetryAfter(retryAfterVal);
          if (serverDelay !== null) {
            delayMs = serverDelay;
          }
        }

        console.warn(
          `[LLM Retry] Attempt ${attempt}/${maxRetries} failed with status=${status || "timeout"}. Retrying in ${Math.round(delayMs)}ms...`
        );
        await sleep(delayMs);
        continue;
      }

      // If timeout exhausted all retries, label it as 504 Gateway Timeout
      if (isTimeout) {
        const timeoutErr = new Error("LLM call timed out after 30 seconds");
        timeoutErr.status = 504;
        throw timeoutErr;
      }

      throw err;
    }
  }
}
