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

---

## 8. Optional Extras (Completed)

### 1. CSV Export (`output/books.csv`)
- Produces standard CSV format from validated records.
- Run command: `node src/export-csv.js`
- **Flattened Values Note**: Multiline descriptions and special commas/quotes are flattened and properly escaped to guarantee valid CSV rows across spreadsheet parsers.

### 2. Selector Fixtures & Unit Testing (`tests/`)
- Uses Node.js built-in test runner (`node --test tests/*.test.js`).
- Includes offline HTML fixtures (`tests/fixtures/missing-description.html` and `tests/fixtures/extra-whitespace.html`).
- **6 Unit Tests Implemented**:
  1. Price normalization (`£51.77` -> `51.77`).
  2. Relative to absolute URL resolution using `new URL()`.
  3. Offline fixture handling for books without descriptions (`null`).
  4. Offline fixture handling for extra whitespace and carriage returns.
  5. Canonical URL deduplication.
  6. Schema validation rejecting malformed fixtures into `errors`.
- Run tests: `npm test`

---

## 9. Bonus Stage — The AI Rematch ("AI vs Me")

### The Hand-Written Specification Prompt
> *"Write a Node.js web scraper using built-in fetch, Cheerio, and Zod that collects books from Books to Scrape (`https://books.toscrape.com/catalogue/page-1.html`). Crawl the first 3 catalogue pages by following pagination 'next' links to discover exactly 60 book detail URLs. For each book, extract 8 raw fields (`title`, `product_url`, `price_text`, `availability_text`, `rating_text`, `description`, `source_page`, `fetched_at`) plus normalized numeric `price_gbp`. Cache every page to disk under `cache/` so reruns don't hit the network. Enforce a 500ms delay between live requests, a polite identifying User-Agent, and a 5s timeout. If a book has no description, store null (do not invent text). Isolate per-page errors so a broken page is skipped and logged without crashing the process. Store deduplicated records to `output/books.json` and generate an honest `output/run-report.json`."*

### Checkpoint Results Comparison
| Metric / Checkpoint | Hand-Built Version (`src/`) | AI-Generated Version (`ai-version/`) |
|---|---|---|
| Discovered Books (3 pages) | 60 | 60 |
| Valid Records Saved | 60 | 60 |
| Cache Hit Re-run (Idempotency) | 60 records (0 duplicates) | 60 records (0 duplicates) |
| Survives Bad URL (`--test-broken`) | Survives, logs to `errors.json`, `failed_pages: 1` | Survives via general catch, increments failed counter |
| Modular Structure | Clean separation (`fetcher`, `crawler`, `extractor`, `schema`, `index`) | Single monolithic file |
| Test Coverage | 6 unit tests with HTML fixtures | No test fixtures |

### Three Concrete Differences
1. **Error Granularity & Retry Logic**: The hand-built version explicitly inspects HTTP status codes and selectively retries transient faults (timeouts / 5xx) while never retrying 404 or 403. The AI version lumped all failures into a generic `try/catch` without distinguished HTTP retry semantics.
2. **Selector Specificity & Defense**: The hand-built version scopes all DOM selectors strictly to `div.product_main` to prevent collisions if the page template contains header/footer prices or recommendations. The AI version used looser selectors like `$("p.price_color").first()`.
3. **Structured Errors & Detailed Provenance**: The hand-built version writes detailed validation issue payloads to `output/errors.json` alongside reason codes and raw record snapshots, whereas the AI version simply incremented a numerical failure counter and discarded the error cause.

---

## 10. LLM API Endpoint: Book Enrichment (`POST /enrich`)

An LLM-powered backend endpoint that takes scraped book details and classifies the genre category, targets audience, creates a 1-sentence summary, and identifies data quality flags.

### Provider Abstraction Note
Three environment variables (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) are the only difference between a model running locally on your laptop (via Ollama) and one running in a cloud datacenter (via OpenRouter). Hardcoding providers is never needed.

### Quick Testing with Stub Mode (`LLM_STUB=1`)
In stub mode, the endpoint verifies input schema and returns an immediate schema-valid object without spending any LLM tokens or quota:

#### 1. Valid Request (`200 OK`)
```bash
curl -s -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"title": "A Light in the Attic", "description": "A collection of poems and drawings."}'
```
**Response:**
```json
{
  "category": "fiction",
  "target_audience": "general",
  "summary": "A stubbed book summary returned in development mode without invoking any LLM calls.",
  "confidence": 0.95,
  "quality_flags": ["clean"]
}
```

#### 2. Deliberately Broken Request (`400 Bad Request`)
```bash
curl -s -i -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"description": "Missing title field"}'
```
**Response:**
```json
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "error": "Bad Request",
  "details": [
    {
      "field": "title",
      "message": "field 'title' is required"
    }
  ]
}
```
