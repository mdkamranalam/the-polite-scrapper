import { discoverCatalogueBooks } from "./crawler.js";
import { politeFetch } from "./fetcher.js";
import { extractRawBookRecord } from "./extractor.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  try {
    // 1. Discover all 60 book URLs from the first 3 catalogue pages
    const { books, cataloguePagesCount } = await discoverCatalogueBooks();

    const rawRecords = [];

    // 2. Fetch and extract details for all 60 books
    for (const book of books) {
      const { html, isCacheHit } = await politeFetch(book.url);

      // Delay between real requests only (no delay on cache hits)
      if (!isCacheHit) {
        await sleep(500);
      }

      const rawRecord = extractRawBookRecord(html, book.url, book.sourcePage);
      rawRecords.push(rawRecord);
    }

    // Checkpoint verification: print one complete raw record and the summary
    console.log("--- Sample Raw Record (all 8 keys) ---");
    console.log(JSON.stringify(rawRecords[0], null, 2));
    console.log(`\ndetail_pages=${rawRecords.length}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
