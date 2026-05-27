import fs from "node:fs";
import path from "node:path";

// Polyfill browser globals BEFORE component modules load (dynamic import below)
if (!globalThis.window) {
  const noop = () => {};
  const mockMatchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
  const mockLocalStorage = {
    getItem: (_k: string) => null,
    setItem: noop,
    removeItem: noop,
    length: 0,
    clear: noop,
    key: () => null,
  };

  // Use defineProperty for read-only globals that can't be set via Object.assign
  const define = (key: string, value: unknown) => {
    try {
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    } catch {
      // already defined and non-configurable - skip
    }
  };

  const mockLocation = { href: "", origin: "https://geoiqai.com", pathname: "/", search: "", hash: "" };
  define("window", { scrollTo: noop, location: mockLocation, matchMedia: mockMatchMedia });
  define("location", mockLocation);
  define("localStorage", mockLocalStorage);
  define("matchMedia", mockMatchMedia);
  define("scrollTo", noop);
}

// Dynamic import ensures polyfills are set before components load
const { render } = await import("./src/entry-server.js");

const STATIC_ROUTES = [
  "/",
  "/what-is-geo",
  "/how-to-rank-in-chatgpt",
  "/geo-tools",
  "/llms-txt-guide",
  "/ai-visibility-score",
  "/ai-visibility-for-indian-startups",
  "/blog",
  "/blog/why-startup-not-showing-chatgpt",
  "/blog/indian-startups-chatgpt-scores",
  "/blog/robots-txt-blocking-ai",
  "/blog/what-is-geo-score",
  "/blog/geo-vs-seo-2026",
  "/pricing",
  "/roadmap",
  "/contact",
  "/privacy",
  "/terms",
];

const distDir = path.resolve("dist/public");

if (!fs.existsSync(distDir)) {
  console.error("dist/public not found - run vite build first");
  process.exit(1);
}

const templatePath = path.join(distDir, "index.html");
const rawTemplate = fs.readFileSync(templatePath, "utf-8");

// Guard: if index.html was already pre-rendered (has root content), we need the
// original Vite template. Detect by checking for the bare injection point.
const INJECTION_POINT = '<div id="root"></div>';
if (!rawTemplate.includes(INJECTION_POINT)) {
  console.error("index.html already pre-rendered - run vite build before prerender");
  process.exit(1);
}

const template = rawTemplate;

/** Strip Replit dev-overlay attributes injected by the Babel plugin at SSR time. */
function stripDevAttributes(html: string): string {
  return html
    .replace(/\s+data-replit-metadata="[^"]*"/g, "")
    .replace(/\s+data-component-name="[^"]*"/g, "");
}

let ok = 0;
let failed = 0;

for (const route of STATIC_ROUTES) {
  try {
    const rawAppHtml = render(route);
    const appHtml = stripDevAttributes(rawAppHtml);

    const html = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );

    const segments = route === "/" ? [] : route.split("/").filter(Boolean);
    const outFile =
      route === "/"
        ? path.join(distDir, "index.html")
        : path.join(distDir, ...segments, "index.html");

    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, html, "utf-8");

    const size = Math.round(Buffer.byteLength(html, "utf-8") / 1024);
    console.log(`[ok] ${route.padEnd(50)} ${size}KB`);
    ok++;
  } catch (err) {
    console.error(
      `[fail] ${route}:`,
      err instanceof Error ? err.message : String(err)
    );
    failed++;
  }
}

console.log(`\nPre-render done: ${ok} success, ${failed} failed`);
if (failed > 0) process.exit(1);
