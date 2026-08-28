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

async function main() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // 1. Discover all 60 book URLs
    const { books } = await discoverCatalogueBooks();

    const validRecordsMap = new Map(); // Canonical URL identity for deduplication & idempotency
    const errors = [];

    // 2. Fetch and extract details
    for (const book of books) {
      const { html, isCacheHit } = await politeFetch(book.url);

      if (!isCacheHit) {
        await sleep(500);
      }

      const rawRecord = extractRawBookRecord(html, book.url, book.sourcePage);
      const validationResult = normalizeAndValidateRecord(rawRecord);

      if (validationResult.success) {
        // Use canonical product_url as record identity
        validRecordsMap.set(
          validationResult.data.product_url,
          validationResult.data,
        );
      } else {
        errors.push({
          url: book.url,
          raw_record: rawRecord,
          reason: validationResult.error,
        });
      }
    }

    const finalValidRecords = Array.from(validRecordsMap.values());

    // 3. Write good records to output/books.json
    const booksFilePath = path.join(OUTPUT_DIR, "books.json");
    await fs.writeFile(
      booksFilePath,
      JSON.stringify(finalValidRecords, null, 2),
      "utf-8",
    );

    // 4. Write failing records to output/errors.json if any
    const errorsFilePath = path.join(OUTPUT_DIR, "errors.json");
    await fs.writeFile(
      errorsFilePath,
      JSON.stringify(errors, null, 2),
      "utf-8",
    );

    // Checkpoint verification
    const allPricesAreNumbers = finalValidRecords.every(
      (r) => typeof r.price_gbp === "number" && !isNaN(r.price_gbp),
    );
    const allUrlsStartWithHttps = finalValidRecords.every(
      (r) =>
        r.product_url.startsWith("https://") &&
        r.source_page.startsWith("https://"),
    );

    console.log(`books_count=${finalValidRecords.length}`);
    console.log(`all_prices_are_numbers=${allPricesAreNumbers}`);
    console.log(`all_urls_start_with_https=${allUrlsStartWithHttps}`);
    console.log(`errors_count=${errors.length}`);
    console.log(`Saved output to ${booksFilePath}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
