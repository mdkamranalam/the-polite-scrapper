# The Polite Scraper

A small, polite scraping pipeline built with Node.js that downloads the first three catalogue pages of Books to Scrape, visits all 60 book pages, turns messy HTML into clean, checked JSON records, survives a broken page without crashing, and ends every run with a short report of what happened.

---

## Target classification

- **Which site**: [Books to Scrape](https://books.toscrape.com/) (hosted at `https://books.toscrape.com/`)
- **Why**: As stated on [toscrape.com](http://toscrape.com/), Books to Scrape is explicitly built as a practice sandbox designed specifically for developers and students to learn and practice web scraping safely without causing harm or violating private policies.
- **How much (Scope)**: The first 3 catalogue pages only (`page-1.html`, `page-2.html`, `page-3.html`), discovering and extracting exactly 60 book detail pages.
- **What data you collect**: Title, canonical product URL, raw price text, normalized numeric price in GBP (`price_gbp`), stock availability text, star rating text, book description, and provenance tracking metadata (`source_page`, `fetched_at`).
- **Why that is appropriate here**: Collecting this data from Books to Scrape is appropriate because the site is an open, static educational sandbox created solely for scraping exercises, containing fictional mock book data with no private, proprietary, or copyrighted personal information.
- **robots.txt result**: Requested `https://books.toscrape.com/robots.txt` once; received HTTP 404 response — **no robots file found**. While a missing file is not blanket permission, the sandbox's explicit public educational mandate provides permission for this assignment.

"I will not reuse this code on another site without checking its rules and terms first."

---

## Tools — JavaScript Lane
- **Runtime**: Node.js 20+
- **HTTP client**: Built-in `fetch`
- **HTML parser**: `cheerio`
- **Schema validator**: `zod`
- **Output**: Built-in file system (`node:fs/promises`) → JSON
