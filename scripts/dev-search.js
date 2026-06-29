import searchBrave from "../src/search/engines/brave.js";
import searchDuckDuckGo from "../src/search/engines/duckduckgo.js";
import searchBing from "../src/search/engines/bing.js";

const query = "yrobot 博客";

(async () => {
  const results = await searchBing({
    query,
  });
  console.log({ results });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
