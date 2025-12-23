import express, { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

const app = express();
const PORT = 8080;

app.use(middlewareLogResponses);

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handlerMetrics);
app.get("/admin/reset", handlerReset);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

/**
 * Middleware to increment fileserver hit counter
 * Tracks the number of requests to the /app path
 */
function middlewareMetricsInc(req: Request, res: Response, next: NextFunction): void {
  config.fileserverHits++;
  next();
}

/**
 * Middleware to log non-OK responses
 * Listens for response finish event and logs requests with non-200 status codes
 */
function middlewareLogResponses(req: Request, res: Response, next: NextFunction): void {
  res.on("finish", () => {
    const statusCode = res.statusCode;
    if (statusCode < 200 || statusCode >= 300) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${statusCode}`);
    }
  });
  next();
}

/**
 * Health check endpoint handler
 * Returns 200 OK to indicate server is ready to receive traffic
 */
function handlerReadiness(req: Request, res: Response): void {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}

/**
 * Admin metrics dashboard handler
 * Returns HTML page displaying fileserver hit count
 */
function handlerMetrics(req: Request, res: Response): void {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<html>
  <body>
    <h1>Welcome, Chirpy Admin</h1>
    <p>Chirpy has been visited ${config.fileserverHits} times!</p>
  </body>
</html>`);
}

/**
 * Admin reset endpoint handler
 * Resets the fileserver hit counter to zero
 */
function handlerReset(req: Request, res: Response): void {
  config.fileserverHits = 0;
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}
