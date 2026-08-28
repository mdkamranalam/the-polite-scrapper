import * as cheerio from "cheerio";
import { politeFetch } from "./fetcher.js";

/**
 * Helper to wait for a given number of milliseconds.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Crawls catalogue pages by following pagination 'next' links up to maxPages.
 * @param {string} startUrl - Starting catalogue page URL
 * @param {number} maxPages - Maximum pages to traverse (default: 3)
 * @returns {Promise<{
 *   books: Array<{ url: string, sourcePage: string }>,
 *   cataloguePagesCount: number,
 *   discoveredCount: number,
 *   uniqueCount: number
 * }>}
 */
export async function discoverCatalogueBooks(
  startUrl = "https://books.toscrape.com/catalogue/page-1.html",
  maxPages = 3,
) {
  let currentUrl = startUrl;
  let cataloguePagesCount = 0;
  const discoveredBooks = [];

  while (currentUrl && cataloguePagesCount < maxPages) {
    cataloguePagesCount++;
    const cacheFilename = `catalogue-page-${cataloguePagesCount}.html`;

    const { html, isCacheHit } = await politeFetch(currentUrl, cacheFilename);

    // Rate limiting: Wait at least 500ms between real network requests (cached pages need no delay)
    if (!isCacheHit) {
      await sleep(500);
    }

    const $ = cheerio.load(html);

    // 1. Extract book links from this catalogue page
    $("article.product_pod").each((_, element) => {
      const linkTag = $(element).find("h3 a");
      const relativeHref = linkTag.attr("href");

      if (relativeHref) {
        // Resolve relative URL to absolute canonical URL using standard URL API
        const absoluteUrl = new URL(relativeHref, currentUrl).href;
        discoveredBooks.push({
          url: absoluteUrl,
          sourcePage: currentUrl,
        });
      }
    });

    // 2. Follow pagination 'next' link to let the site tell us what the next page is
    const nextHref = $("li.next a").attr("href");
    if (nextHref && cataloguePagesCount < maxPages) {
      currentUrl = new URL(nextHref, currentUrl).href;
    } else {
      currentUrl = null;
    }
  }

  // 3. Remove duplicate links while preserving discovery order
  const seenUrls = new Set();
  const uniqueBooks = [];

  for (const book of discoveredBooks) {
    if (!seenUrls.has(book.url)) {
      seenUrls.add(book.url);
      uniqueBooks.push(book);
    }
  }

  return {
    books: uniqueBooks,
    cataloguePagesCount,
    discoveredCount: discoveredBooks.length,
    uniqueCount: uniqueBooks.length,
  };
}
