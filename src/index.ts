import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "./errors.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();
const PORT = 8080;

app.use(middlewareLogResponses);

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/api/healthz", handlerReadiness);
app.post("/api/validate_chirp", (req, res, next) => {
  Promise.resolve(handlerValidateChirp(req, res)).catch(next);
});
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", handlerReset);

app.use(errorHandler);

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
 * Error handling middleware
 * Catches and handles all errors, responding with appropriate status codes
 */
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.log(err);
  
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
  } else if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
  } else {
    res.status(500).json({ error: "Something went wrong on our end" });
  }
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
 * Validate chirp endpoint handler
 * Accepts JSON body with chirp text, validates length, and filters profanity
 */
async function handlerValidateChirp(req: Request, res: Response): Promise<void> {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  await new Promise<void>((resolve) => {
    req.on("end", () => resolve());
  });

  const parsedBody = JSON.parse(body);
  
  if (!parsedBody.body || typeof parsedBody.body !== "string") {
    res.status(400);
    res.header("Content-Type", "application/json");
    res.send(JSON.stringify({ error: "Invalid request body" }));
    return;
  }

  if (parsedBody.body.length > 140) {
    throw new BadRequestError("Chirp is too long. Max length is 140");
  }

  const cleanedBody = cleanProfanity(parsedBody.body);

  res.status(200);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify({ cleanedBody }));
}

/**
 * Cleans profanity from text by replacing banned words with asterisks
 * @param text - The text to clean
 * @returns The cleaned text with profane words replaced by ****
 */
function cleanProfanity(text: string): string {
  const profaneWords = ["kerfuffle", "sharbert", "fornax"];
  const words = text.split(" ");
  
  const cleanedWords = words.map((word) => {
    const lowerWord = word.toLowerCase();
    if (profaneWords.includes(lowerWord)) {
      return "****";
    }
    return word;
  });
  
  return cleanedWords.join(" ");
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
