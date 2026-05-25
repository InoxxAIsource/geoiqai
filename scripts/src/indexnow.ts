const HOST = "geoiqai.com";
const KEY = "geoiqai2026key";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const ALL_URLS = [
  `https://${HOST}/`,
  `https://${HOST}/what-is-geo`,
  `https://${HOST}/how-to-rank-in-chatgpt`,
  `https://${HOST}/geo-tools`,
  `https://${HOST}/pricing`,
  `https://${HOST}/llms-txt-guide`,
  `https://${HOST}/ai-visibility-score`,
  `https://${HOST}/ai-visibility-for-indian-startups`,
  `https://${HOST}/blog`,
  `https://${HOST}/blog/why-startup-not-showing-chatgpt`,
  `https://${HOST}/blog/indian-startups-chatgpt-scores`,
  `https://${HOST}/blog/robots-txt-blocking-ai`,
  `https://${HOST}/blog/what-is-geo-score`,
  `https://${HOST}/blog/geo-vs-seo-2026`,
  `https://${HOST}/roadmap`,
  `https://${HOST}/contact`,
  `https://${HOST}/privacy`,
  `https://${HOST}/terms`,
];

async function submitToIndexNow(urls: string[]): Promise<void> {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (res.status === 200 || res.status === 202) {
    console.log(`IndexNow: submitted ${urls.length} URL(s) - HTTP ${res.status} accepted`);
  } else {
    const body = await res.text();
    console.error(`IndexNow: failed - HTTP ${res.status}: ${body}`);
    process.exit(1);
  }
}

const extra = process.argv.slice(2);
const urlsToSubmit = extra.length > 0 ? extra : ALL_URLS;

submitToIndexNow(urlsToSubmit).catch((err) => {
  console.error("IndexNow: unexpected error:", err);
  process.exit(1);
});
