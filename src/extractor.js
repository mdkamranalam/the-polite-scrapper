import * as cheerio from "cheerio";

/**
 * Extracts 8 raw fields from a book detail page HTML with provenance metadata.
 * @param {string} html - Raw HTML of book detail page
 * @param {string} productUrl - Absolute canonical URL of book
 * @param {string} sourcePage - Catalogue page URL that discovered this book
 * @param {string} [fetchedAt] - ISO 8601 UTC timestamp of fetch
 * @returns {{
 *   title: string|null,
 *   product_url: string,
 *   price_text: string|null,
 *   availability_text: string|null,
 *   rating_text: string|null,
 *   description: string|null,
 *   source_page: string,
 *   fetched_at: string
 * }}
 */
export function extractRawBookRecord(
  html,
  productUrl,
  sourcePage,
  fetchedAt = new Date().toISOString(),
) {
  const $ = cheerio.load(html);

  // Aim selectors specifically at product area (.product_main)
  const productMain = $("div.product_main");

  // 1. Title
  const title =
    productMain.find("h1").text().trim() ||
    $("h1").text().trim() ||
    null;

  // 2. Price text
  const priceText =
    productMain.find("p.price_color").text().trim() || null;

  // 3. Availability text (clean excess whitespace/newlines)
  const rawAvail = productMain.find("p.instock.availability").text();
  const availabilityText = rawAvail
    ? rawAvail.replace(/\s+/g, " ").trim()
    : null;

  // 4. Rating text (e.g. class "star-rating Three" -> "Three")
  let ratingText = null;
  const ratingElement = productMain.find("p.star-rating");
  if (ratingElement.length) {
    const classList = (ratingElement.attr("class") || "").split(/\s+/);
    const specificRating = classList.find((c) => c !== "star-rating");
    if (specificRating) {
      ratingText = specificRating;
    }
  }

  // 5. Description (Some books have no description -> store null, never invent text)
  let description = null;
  const descHeader = $("#product_description");
  if (descHeader.length) {
    const descParagraph = descHeader.next("p");
    if (descParagraph.length) {
      const text = descParagraph.text().trim();
      if (text.length > 0) {
        description = text;
      }
    }
  }

  // Return raw record showing all 8 keys
  return {
    title,
    product_url: productUrl,
    price_text: priceText,
    availability_text: availabilityText,
    rating_text: ratingText,
    description,
    source_page: sourcePage,
    fetched_at: fetchedAt,
  };
}
