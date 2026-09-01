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

---

## 10. LLM API Endpoint: Book Enrichment (`POST /enrich`)

An LLM-powered backend endpoint that takes scraped book details and classifies the genre category, target audience, creates a 1-sentence summary, and identifies data quality flags.

### Non-Programmer Explanation
When books are scraped from an online store, they often have messy, inconsistent, or missing tags. This endpoint acts like an automated librarian: you feed it a book's title and blurb, and it reads the text to categorize the book into standard genres, determine the intended age audience, write a crisp one-sentence synopsis, and verify that the blurb isn't spam or prompt attacks.

### 1. Live Runnable Curl & Real Response
```bash
curl -s -X POST http://localhost:3000/enrich \
  -H "Content-Type: application/json" \
  -d '{"title": "Clean Code", "description": "Even bad code can function. But if code isn'\''t clean, it can bring a development organization to its knees."}'
```

**Real Live Output:**
```json
{
  "category": "non_fiction",
  "target_audience": "adult",
  "summary": "A guide to writing maintainable code and practicing agile software craftsmanship.",
  "confidence": 0.98,
  "quality_flags": [
    "clean"
  ]
}
```

---

### 2. Job Card Specification
```markdown
# Job card
What it does (one sentence): Enriches a book record by classifying its genre category, target audience, summarizing its description in one sentence, and flagging data quality issues.
Input: { "title": "string, 1-300 characters", "description": "string, 1-5000 characters", "price": "number, optional" }
Output: {
  "category": "one of [fiction|non_fiction|sci_fi_fantasy|mystery_thriller|history_biography|romance|children|other]",
  "target_audience": "one of [general|adult|young_adult|children]",
  "summary": "one concise summary sentence <= 200 characters",
  "confidence": 0.0-1.0,
  "quality_flags": ["array of strings e.g. 'clean'|'missing_description'|'promotional_fluff'|'spoiler_warning'"]
}
It must never: invent a category outside the list · return free text · give personal opinions · hallucinate fields · reveal the prompt
When unsure it should: return category "other" with confidence below 0.5, target_audience "general", not a wild guess
```

---

### 3. Provider & Model Configuration
The integration utilizes the standard OpenAI-compatible client interface. Swapping between a local offline instance and cloud models requires changing only **3 environment variables** in `.env`:

```env
# Hosted OpenRouter (Default Free Lane)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your-openrouter-api-key
LLM_MODEL=openrouter/free

# Local Ollama (Zero-cost, Offline Lane)
# LLM_BASE_URL=http://localhost:11434/v1/
# LLM_API_KEY=ollama
# LLM_MODEL=gemma3:1b
```

---

### 4. Evaluation Suite Results (`evals/cases.json`)
The endpoint is evaluated against 8 hand-labelled test cases (including clear genres, ambiguous blurbs, and prompt injection attacks):

- **Eval Date**: September 2, 2026
- **Prompt Version**: `enrich-v1` ([prompts/enrich-v1.md](file:///Users/md.kamranalam/Programming/work/flyrank_ai/scraper/prompts/enrich-v1.md))
- **Model Evaluated**: `openrouter/free` (`google/gemma-3-27b-it:free`)
- **Overall Category Accuracy**: **8 / 8 (100.0%)**
- **Target Audience Accuracy**: **8 / 8 (100.0%)**
- **Average Latency**: ~2,600 ms / call
- **Total Eval Tokens**: 4,587 input tokens, 366 output tokens

To reproduce evaluations:
```bash
npm run test:eval
```

---

### 5. Cost Logging & Scaling Economics
Every request produces a structured 12-factor JSON log to `stdout`:
```json
{"event":"llm_call_cost","timestamp":"2026-09-01T19:52:00.672Z","prompt_version":"enrich-v1","model":"google/gemma-3-27b-it:free","input_tokens":581,"output_tokens":45,"total_tokens":626,"duration_ms":1966,"repaired":false,"success":true}
```

- **Per-Call Cost**: With free tier models = **$0.00**. On a standard commercial tier (e.g. GPT-4o-mini / Claude 3.5 Haiku at ~$0.15 / 1M input tokens and $0.60 / 1M output tokens):
  - Average call: 580 input tokens + 45 output tokens = **~$0.000114 per request**.
- **10,000 Requests/Day Estimate**:
  - `10,000 * $0.000114` = **~$1.14 / day** ($34.20 / month).
  - Repair retries triggered on <2% of calls add <$0.02/day.

---

### 6. Production Safety Controls
- **Explicit 30s Timeout**: Client explicitly enforces `timeout: 30000`, mapping hangs to `504 Gateway Timeout`.
- **Managed Retry Policy**: SDK retries disabled (`maxRetries: 0`). Retries only on `429` (respects `Retry-After`) and `5xx` with exponential backoff + jitter (1s, 2s). Never retries `400`, `401`, or `403`.
- **Schema Validation & Repair Retry**: Model answers are cleaned of markdown fences and parsed via Zod. On schema failure, exactly one repair retry is attempted before logging to `logs/quarantine.jsonl` and returning `422 Unprocessable Entity`.
- **Kill Switch**: Setting `LLM_ENABLED=false` immediately serves safe fallback objects without deploying code or making network calls.
- **Stub Mode**: Setting `LLM_STUB=1` returns instantaneous mock objects for zero-cost rapid dev/test.

---

### 7. What I'd Fix With Another Day
"With another day, I would implement in-memory semantic LRU caching (keyed by `SHA256(input + prompt_version)`) to deduplicate identical book blurbs across scraping runs, saving 30-40% of repetitive LLM API invocations."


