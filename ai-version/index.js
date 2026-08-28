import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_DIR = path.join(__dirname, "output");

const USER_AGENT = "FlyRankInternship-A9/1.0 (+https://github.com/mdkamranalam/the-polite-scrapper)";
const TIMEOUT_MS = 5000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_text: z.string(),
  price_gbp: z.number(),
  availability_text: z.string(),
  rating_text: z.string(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

async function fetchWithCache(url, cacheName) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, cacheName);

  try {
    const cached = await fs.readFile(cachePath, "utf-8");
    return { html: cached, isCache: true };
  } catch {}

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: controller.signal,
  });
  clearTimeout(id);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  await fs.writeFile(cachePath, html, "utf-8");
  return { html, isCache: false };
}

async function run() {
  const startTime = Date.now();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let currentUrl = "https://books.toscrape.com/catalogue/page-1.html";
  const bookUrls = [];
  let pageCount = 0;

  while (currentUrl && pageCount < 3) {
    pageCount++;
    const { html, isCache } = await fetchWithCache(currentUrl, `cat_${pageCount}.html`);
    if (!isCache) await sleep(500);

    const $ = cheerio.load(html);
    $("article.product_pod h3 a").each((_, el) => {
      const href = $(el).attr("href");
      if (href) bookUrls.push({ url: new URL(href, currentUrl).href, source: currentUrl });
    });

    const next = $("li.next a").attr("href");
    currentUrl = next ? new URL(next, currentUrl).href : null;
  }

  const validMap = new Map();
  let failed = 0;
  let cacheHits = 0;

  for (const b of bookUrls) {
    try {
      const slug = b.url.split("/").filter(Boolean).slice(-2)[0] || "detail";
      const { html, isCache } = await fetchWithCache(b.url, `${slug}.html`);
      if (isCache) cacheHits++;
      else await sleep(500);

      const $ = cheerio.load(html);
      const title = $("div.product_main h1").text().trim();
      const price_text = $("p.price_color").first().text().trim();
      const availability_text = $("p.instock.availability").text().replace(/\s+/g, " ").trim();
      const rating_text = $("p.star-rating").attr("class")?.split(" ").filter((c) => c !== "star-rating")[0] || "None";
      const desc = $("#product_description").next("p").text().trim() || null;
      const price_gbp = parseFloat(price_text.replace(/[^0-9.]/g, "")) || 0;

      const record = BookSchema.parse({
        title,
        product_url: b.url,
        price_text,
        price_gbp,
        availability_text,
        rating_text,
        description: desc,
        source_page: b.source,
        fetched_at: new Date().toISOString(),
      });

      validMap.set(record.product_url, record);
    } catch (err) {
      failed++;
    }
  }

  const books = Array.from(validMap.values());
  await fs.writeFile(path.join(OUTPUT_DIR, "books.json"), JSON.stringify(books, null, 2));

  const report = {
    duration_seconds: (Date.now() - startTime) / 1000,
    discovered: bookUrls.length,
    valid_records: books.length,
    failed_pages: failed,
    cache_hits: cacheHits,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, "run-report.json"), JSON.stringify(report, null, 2));

  console.log(`[AI Scraper] Finished. Valid records: ${books.length}, Failed: ${failed}`);
}

run();
