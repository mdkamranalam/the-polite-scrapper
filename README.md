# The Polite Scraper

A small, polite scraping pipeline built with Node.js that downloads the first three catalogue pages of [Books to Scrape](https://books.toscrape.com/), visits all 60 book pages, extracts and normalizes fields into validated JSON records, survives broken pages gracefully, and produces an execution report.

---

## 1. Target classification (Stage 0)

- **Which site**: [Books to Scrape](https://books.toscrape.com/) (`https://books.toscrape.com/`)
- **Why**: As stated on [toscrape.com](http://toscrape.com/), Books to Scrape is explicitly built as a practice sandbox designed specifically for developers and students to learn and practice web scraping safely without causing harm or violating private policies.
- **How much (Scope)**: The first 3 catalogue pages only (`page-1.html`, `page-2.html`, `page-3.html`), discovering and extracting exactly 60 book detail pages.
- **What data you collect**: Title, canonical product URL, raw price text, normalized numeric price in GBP (`price_gbp`), stock availability text, star rating text, book description, and provenance tracking metadata (`source_page`, `fetched_at`).
- **Why that is appropriate here**: Collecting this data from Books to Scrape is appropriate because the site is an open, static educational sandbox created solely for scraping exercises, containing fictional mock book data with no private, proprietary, or copyrighted personal information.
- **robots.txt result**: Requested `https://books.toscrape.com/robots.txt` once; received HTTP 404 response — **no robots file found**. While a missing file is not blanket permission, the sandbox's explicit public educational mandate provides permission for this assignment.

"I will not reuse this code on another site without checking its rules and terms first."

---

## 2. Quickstart & Installation

### Lane
**JavaScript Lane** (Node.js 20+, Built-in fetch, Cheerio, Zod, Built-in fs & test runner).

### Installation
```bash
npm install
```

### Run Scraper (One Copy-Pasteable Run Command)
```bash
npm start
```

### Run Failure Survival Test
```bash
npm run test:broken
```

---

## 3. Record Schema

Every record stored in `output/books.json` strictly adheres to the following schema validated via **Zod**:

```json
{
  "title": "A Light in the Attic",
  "product_url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
  "price_text": "£51.77",
  "price_gbp": 51.77,
  "availability_text": "In stock (22 available)",
  "rating_text": "Three",
  "description": "It's hard to imagine a world without A Light in the Attic...",
  "source_page": "https://books.toscrape.com/catalogue/page-1.html",
  "fetched_at": "2026-08-28T18:54:26.751Z"
}
```

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Title of the book |
| `product_url` | `string` (URL) | Canonical absolute URL starting with `https://` |
| `price_text` | `string` | Raw price string (e.g. `£51.77`) |
| `price_gbp` | `number` | Cleaned numeric price in GBP (e.g. `51.77`) |
| `availability_text` | `string` | Stock availability text |
| `rating_text` | `string` | Star rating textual value (`One`, `Two`, `Three`, etc.) |
| `description` | `string \| null` | Product description text or `null` if missing |
| `source_page` | `string` (URL) | Provenance tracking link indicating discovery origin |
| `fetched_at` | `string` (ISO 8601) | Timestamp of when the record was fetched |

---

## 4. Politeness Rules Followed

1. **Identifying User-Agent**: Every request sends `FlyRankInternship-A9/1.0 (+https://github.com/mdkamranalam/the-polite-scrapper)` so server operators know who is scraping and where to reach out.
2. **Polite Delay**: A minimum rate limit delay of at least 500ms is enforced between real requests to prevent overloading the server.
3. **Timeout**: Requests use a strict 5-second `AbortSignal` timeout to prevent hanging sockets.
4. **Local Caching**: HTML pages are cached locally under `cache/`. During development, cached copies are read instantly from disk without hitting the remote server (`CACHE HIT`).
5. **Idempotency**: Using canonical `product_url` as unique record identity ensures running the pipeline twice produces the same 60 records without duplication.

---

## 5. Real Run Report Proof

Below is a real execution report from `output/run-report.json`:

```json
{
  "start_time": "2026-08-28T19:02:11.105Z",
  "duration_seconds": 0.12,
  "catalogue_pages": 3,
  "detail_pages_total": 60,
  "pages_fetched": 0,
  "cache_hits": 60,
  "valid_records": 60,
  "invalid_records": 0,
  "failed_pages": 0
}
```

### Why No Browser Was Needed
The data is already present in the raw static HTML the server sends over HTTP, so spinning up a headless browser (such as Puppeteer or Playwright) would only add unnecessary CPU, memory, and latency overhead without any benefit.

---

## 6. Ethics Note

- **Official APIs First**: Always check for and use an official REST/GraphQL API if one is provided before attempting to scrape web pages.
- **Respect Boundaries**: Never bypass logins, paywalls, CAPTCHAs, or IP blocks.
- **Collect Minimally**: Scrape only the specific data points needed for the application and nothing more.
- **Be a Polite Guest**: Always identify your scraper honestly in the `User-Agent`, respect `robots.txt`, throttle request speeds, and cache responses locally.

---

## 7. Honest Limitation

- **Static Content Only**: The pipeline is designed for static server-rendered HTML. It does not evaluate client-side JavaScript rendering (Single Page Applications / client-side hydrated frameworks).
