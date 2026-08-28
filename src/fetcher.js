import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(path.dirname(__dirname), "cache");

// Politeness defaults
const USER_AGENT =
  "FlyRankInternship-A9/1.0 (+https://github.com/mdkamranalam/the-polite-scrapper)";
const TIMEOUT_MS = 5000; // 5 seconds timeout

/**
 * Polite fetcher with timeout, status validation, and disk caching.
 * @param {string} url - Target URL
 * @param {string} customCacheFilename - Filename in cache/ directory
 * @returns {Promise<{ html: string, isCacheHit: boolean, size: number, status: number }>}
 */
export async function politeFetch(url, customCacheFilename) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, customCacheFilename);

  // 1. Check disk cache first
  try {
    const cachedHtml = await fs.readFile(cachePath, "utf-8");
    const size = Buffer.byteLength(cachedHtml, "utf-8");
    return { html: cachedHtml, isCacheHit: true, size, status: 200 };
  } catch {
    // Cache miss: proceed to fetch
  }

  // 2. Fetch with polite user-agent and AbortSignal timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // 3. Status check: Only 200 means "here is your page"
    if (response.status !== 200) {
      throw new Error(
        `Failed to fetch page. HTTP status code: ${response.status}`,
      );
    }

    const html = await response.text();
    const size = Buffer.byteLength(html, "utf-8");

    // 4. Save to cache
    await fs.writeFile(cachePath, html, "utf-8");

    return { html, isCacheHit: false, size, status: response.status };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  }
}
