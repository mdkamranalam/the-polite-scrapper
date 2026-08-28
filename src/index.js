import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverCatalogueBooks } from "./crawler.js";
import { politeFetch } from "./fetcher.js";
import { extractRawBookRecord } from "./extractor.js";
import { normalizeAndValidateRecord } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(path.dirname(__dirname), "output");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch a book detail page with single retry on timeout or 5xx; do not retry on 404 or 403.
 */
async function fetchDetailPageWithRetry(url) {
  const maxAttempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await politeFetch(url);
      return { ...result, error: null };
    } catch (err) {
      lastError = err;
      const status = err.status;

      // Do NOT retry 404 (does not exist) or 403 (forbidden)
      if (status === 404 || status === 403) {
        break;
      }

      // Retry on timeout or 5xx server errors
      const isRetryable = err.isTimeout || (status && status >= 500);
      if (isRetryable && attempt < maxAttempts) {
        await sleep(1000); // wait a moment before trying once more
        continue;
      }

      break;
    }
  }

  return { html: null, isCacheHit: false, size: 0, status: lastError.status || 0, error: lastError.message };
}

async function main() {
  const startTimeIso = new Date().toISOString();
  const startTime = Date.now();

  const isTestBroken = process.argv.includes("--test-broken");

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 1. Discover all 60 book URLs
    const { books, cataloguePagesCount } = await discoverCatalogueBooks();

    // If --test-broken flag is passed, inject one deliberately broken fake URL
    if (isTestBroken) {
      const fakeUrl =
        "https://books.toscrape.com/catalogue/deliberately-broken-fake-book_9999/index.html";
      console.log(`[TEST] Injecting fake broken URL: ${fakeUrl}`);
      books.push({
        url: fakeUrl,
        sourcePage: "https://books.toscrape.com/catalogue/page-1.html",
      });
    }

    const validRecordsMap = new Map();
    const invalidRecords = [];
    const failedPages = [];

    let pagesFetched = 0;
    let cacheHits = 0;

    // 2. Fetch and extract each page separately (one bad page must not kill the run)
    for (const book of books) {
      const { html, isCacheHit, error } = await fetchDetailPageWithRetry(
        book.url,
      );

      if (isCacheHit) {
        cacheHits++;
      } else {
        pagesFetched++;
        await sleep(500);
      }

      // If page fetch failed, record it and gracefully skip to the next
      if (error || !html) {
        failedPages.push({
          url: book.url,
          reason: error || "Empty or invalid response",
        });
        continue;
      }

      try {
        const rawRecord = extractRawBookRecord(html, book.url, book.sourcePage);
        const validationResult = normalizeAndValidateRecord(rawRecord);

        if (validationResult.success) {
          validRecordsMap.set(
            validationResult.data.product_url,
            validationResult.data,
          );
        } else {
          invalidRecords.push({
            url: book.url,
            raw_record: rawRecord,
            reason: validationResult.error,
          });
        }
      } catch (err) {
        invalidRecords.push({
          url: book.url,
          reason: err.message,
        });
      }
    }

    const finalValidRecords = Array.from(validRecordsMap.values());

    // 3. Write output/books.json
    const booksFilePath = path.join(OUTPUT_DIR, "books.json");
    await fs.writeFile(
      booksFilePath,
      JSON.stringify(finalValidRecords, null, 2),
      "utf-8",
    );

    // 4. Write output/errors.json
    const errorsFilePath = path.join(OUTPUT_DIR, "errors.json");
    await fs.writeFile(
      errorsFilePath,
      JSON.stringify({ invalid_records: invalidRecords, failed_pages: failedPages }, null, 2),
      "utf-8",
    );

    // 5. Write output/run-report.json
    const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));
    const runReport = {
      start_time: startTimeIso,
      duration_seconds: durationSeconds,
      catalogue_pages: cataloguePagesCount,
      detail_pages_total: books.length,
      pages_fetched: pagesFetched,
      cache_hits: cacheHits,
      valid_records: finalValidRecords.length,
      invalid_records: invalidRecords.length,
      failed_pages: failedPages.length,
    };

    const reportFilePath = path.join(OUTPUT_DIR, "run-report.json");
    await fs.writeFile(
      reportFilePath,
      JSON.stringify(runReport, null, 2),
      "utf-8",
    );

    console.log("\n--- Run Report ---");
    console.log(JSON.stringify(runReport, null, 2));
    console.log(`\nbooks.json has ${finalValidRecords.length} good records.`);
  } catch (error) {
    console.error(`Fatal Pipeline Error: ${error.message}`);
  }
}

main();
