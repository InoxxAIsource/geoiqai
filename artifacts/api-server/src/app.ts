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

// Serve sitemap.xml directly from source - bypasses CDN/build cache
app.get("/sitemap.xml", (_req, res) => {
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.resolve(process.cwd(), "../geoscore/public/sitemap.xml"));
});

app.use(seoPagesRouter);
app.use(seoPagesRouter2);
app.use("/api", router);

export default app;
