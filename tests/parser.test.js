import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizePrice, normalizeAndValidateRecord } from "../src/schema.js";
import { extractRawBookRecord } from "../src/extractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, "fixtures");

test("1. Price normalization - correctly parses numeric price", () => {
  assert.equal(normalizePrice("£51.77"), 51.77);
  assert.equal(normalizePrice("£0.99"), 0.99);
  assert.equal(normalizePrice("19.50"), 19.5);
  assert.throws(() => normalizePrice(""), /Invalid priceText/);
  assert.throws(() => normalizePrice("free"), /Could not parse numeric price/);
});

test("2. Relative to absolute URL resolution", () => {
  const baseCatalogueUrl = "https://books.toscrape.com/catalogue/page-1.html";
  const relativeProduct = "../a-light-in-the-attic_1000/index.html";
  const absoluteUrl = new URL(relativeProduct, baseCatalogueUrl).href;
  assert.equal(
    absoluteUrl,
    "https://books.toscrape.com/a-light-in-the-attic_1000/index.html",
  );

  const relativeNext = "page-2.html";
  const absoluteNext = new URL(relativeNext, baseCatalogueUrl).href;
  assert.equal(
    absoluteNext,
    "https://books.toscrape.com/catalogue/page-2.html",
  );
});

test("3. Fixture: Missing description handled cleanly as null", async () => {
  const html = await fs.readFile(
    path.join(FIXTURES_DIR, "missing-description.html"),
    "utf-8",
  );
  const raw = extractRawBookRecord(
    html,
    "https://books.toscrape.com/catalogue/the-secret-garden_1/index.html",
    "https://books.toscrape.com/catalogue/page-1.html",
  );

  assert.equal(raw.title, "The Secret Garden");
  assert.equal(raw.description, null);
  assert.equal(raw.price_text, "£15.00");
  assert.equal(raw.rating_text, "Four");

  const validated = normalizeAndValidateRecord(raw);
  assert.equal(validated.success, true);
  assert.equal(validated.data.description, null);
  assert.equal(validated.data.price_gbp, 15.0);
});

test("4. Fixture: Extra whitespace and newlines cleaned", async () => {
  const html = await fs.readFile(
    path.join(FIXTURES_DIR, "extra-whitespace.html"),
    "utf-8",
  );
  const raw = extractRawBookRecord(
    html,
    "https://books.toscrape.com/catalogue/messy-book_2/index.html",
    "https://books.toscrape.com/catalogue/page-1.html",
  );

  assert.equal(raw.title, "A Book With Messy Whitespace & Newlines");
  assert.equal(raw.price_text, "£29.95");
  assert.equal(raw.availability_text, "In stock (3 available)");
  assert.equal(
    raw.description,
    "This is a description with trailing and leading whitespace.",
  );
  assert.equal(raw.rating_text, "Five");
});

test("5. Deduplication by canonical URL", () => {
  const duplicateRecords = [
    {
      title: "Book 1",
      product_url: "https://books.toscrape.com/b1",
      price_text: "£10.00",
      price_gbp: 10.0,
      availability_text: "In stock",
      rating_text: "One",
      description: null,
      source_page: "https://books.toscrape.com/p1",
      fetched_at: "2026-08-28T00:00:00.000Z",
    },
    {
      title: "Book 1 (Duplicated)",
      product_url: "https://books.toscrape.com/b1",
      price_text: "£10.00",
      price_gbp: 10.0,
      availability_text: "In stock",
      rating_text: "One",
      description: null,
      source_page: "https://books.toscrape.com/p1",
      fetched_at: "2026-08-28T00:00:00.000Z",
    },
    {
      title: "Book 2",
      product_url: "https://books.toscrape.com/b2",
      price_text: "£20.00",
      price_gbp: 20.0,
      availability_text: "In stock",
      rating_text: "Two",
      description: "Desc 2",
      source_page: "https://books.toscrape.com/p1",
      fetched_at: "2026-08-28T00:00:00.000Z",
    },
  ];

  const map = new Map();
  for (const r of duplicateRecords) {
    map.set(r.product_url, r);
  }

  const deduped = Array.from(map.values());
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].product_url, "https://books.toscrape.com/b1");
  assert.equal(deduped[1].product_url, "https://books.toscrape.com/b2");
});

test("6. Malformed HTML fixture rejected by schema validator", () => {
  const brokenRaw = {
    title: "Broken Book",
    product_url: "not-a-valid-url",
    price_text: "No price here",
    availability_text: "In stock",
    rating_text: "One",
    description: null,
    source_page: "https://books.toscrape.com/catalogue/page-1.html",
    fetched_at: "invalid-date",
  };

  const validation = normalizeAndValidateRecord(brokenRaw);
  assert.equal(validation.success, false);
  assert.ok(validation.error);
});
