import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(path.dirname(__dirname), "output");

/**
 * Escapes CSV field value and handles multiline flattening.
 * @param {any} val
 * @returns {string}
 */
function escapeCsvValue(val) {
  if (val === null || val === undefined) {
    return "";
  }
  // Flatten multiline strings (like book descriptions) to single-line spaces for clean CSV formatting
  const str = String(val).replace(/\r\n|\n|\r/g, " ").trim();
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportBooksToCsv() {
  const jsonPath = path.join(OUTPUT_DIR, "books.json");
  const csvPath = path.join(OUTPUT_DIR, "books.csv");

  const rawJson = await fs.readFile(jsonPath, "utf-8");
  const records = JSON.parse(rawJson);

  if (!records.length) {
    console.log("No records found in books.json to export.");
    return;
  }

  const headers = [
    "title",
    "product_url",
    "price_text",
    "price_gbp",
    "availability_text",
    "rating_text",
    "description",
    "source_page",
    "fetched_at",
  ];

  const lines = [headers.join(",")];

  for (const record of records) {
    const row = headers.map((header) => escapeCsvValue(record[header]));
    lines.push(row.join(","));
  }

  await fs.writeFile(csvPath, lines.join("\n"), "utf-8");
  console.log(`[CSV Export] Successfully exported ${records.length} records to output/books.csv`);
  console.log(`[Note] 'description' field had multiline breaks flattened into single spaces for standard CSV compatibility.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  exportBooksToCsv().catch(console.error);
}
