import { politeFetch } from "./fetcher.js";

async function main() {
  const targetUrl = "https://books.toscrape.com/catalogue/page-1.html";
  const cacheFile = "catalogue-page-1.html";

  try {
    const result = await politeFetch(targetUrl, cacheFile);

    if (result.isCacheHit) {
      console.log(`CACHE HIT - size: ${result.size} bytes (${cacheFile})`);
    } else {
      console.log(
        `FETCH - status: ${result.status}, size: ${result.size} bytes (saved to cache/${cacheFile})`,
      );
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main();
