import { discoverCatalogueBooks } from "./crawler.js";

async function main() {
  try {
    const { cataloguePagesCount, discoveredCount, uniqueCount } =
      await discoverCatalogueBooks();

    console.log(
      `catalogue_pages=${cataloguePagesCount}, discovered=${discoveredCount}, unique_urls=${uniqueCount}`,
    );
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
