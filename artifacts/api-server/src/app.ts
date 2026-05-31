import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import seoPagesRouter from "./routes/seo-pages";
import seoPagesRouter2 from "./routes/seo-pages-2";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());

// Security headers on all responses
app.use((_req, res, next) => {
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Capture raw body for Razorpay webhook signature verification before JSON parsing
app.use("/api/payment/webhook", express.raw({ type: "application/json" }), (req, _res, next) => {
  (req as express.Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve sitemap.xml inline - avoids any file-path dependency in production
const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://geoiqai.com/</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://geoiqai.com/generative-engine-optimization</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
  <url><loc>https://geoiqai.com/what-is-geo</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/how-to-rank-in-chatgpt</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/perplexity-seo</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/chatgpt-brand-visibility</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/ai-search-optimization</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/google-ai-overview-seo</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/geo-optimization-checklist</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/geo-tools</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/llms-txt-guide</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/ai-visibility-score</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/ai-visibility-for-indian-startups</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/gemini-seo</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/geoiq-vs-rankscale</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/geoiq-vs-profound</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/geoiq-vs-semrush</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/rankscale-alternative</loc><lastmod>2026-05-28</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/pricing</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/audit</loc><lastmod>2026-05-25</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://geoiqai.com/blog</loc><lastmod>2026-05-28</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/blog/indian-startups-chatgpt-scores</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/blog/robots-txt-blocking-ai</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/blog/what-is-geo-score</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/blog/geo-vs-seo-2026</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/blog/why-startup-not-showing-chatgpt</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/ai-search-ranking-factors</loc><lastmod>2026-05-30</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/best-ai-visibility-tools</loc><lastmod>2026-05-30</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://geoiqai.com/faq</loc><lastmod>2026-05-30</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://geoiqai.com/roadmap</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://geoiqai.com/contact</loc><lastmod>2026-05-25</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>https://geoiqai.com/privacy</loc><lastmod>2026-05-25</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
  <url><loc>https://geoiqai.com/terms</loc><lastmod>2026-05-25</lastmod><changefreq>yearly</changefreq><priority>0.3</priority></url>
</urlset>`;

app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(SITEMAP_XML);
});

app.use(seoPagesRouter);
app.use(seoPagesRouter2);
app.use("/api", router);

export default app;
