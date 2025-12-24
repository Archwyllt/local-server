import express, { Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { config } from "./config.js";
import { BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError } from "./errors.js";
import { createUser, getUserByEmail, deleteAllUsers } from "./db/queries/users.js";
import { createChirp, getAllChirps, deleteAllChirps } from "./db/queries/chirps.js";
import { hashPassword, checkPasswordHash, makeJWT, validateJWT, getBearerToken } from "./auth.js";
import { UserResponse } from "./db/schema.js";

const migrationClient = postgres(config.db.url, { max: 1 });
await migrate(drizzle(migrationClient), config.db.migrationConfig);

const app = express();
const PORT = 8080;

app.use(middlewareLogResponses);

app.use("/app", middlewareMetricsInc, express.static("./src/app"));

app.get("/api/healthz", handlerReadiness);
app.post("/api/users", (req, res, next) => {
  Promise.resolve(handlerCreateUser(req, res)).catch(next);
});
app.post("/api/login", (req, res, next) => {
  Promise.resolve(handlerLogin(req, res)).catch(next);
});
app.post("/api/chirps", (req, res, next) => {
  Promise.resolve(handlerCreateChirp(req, res)).catch(next);
});
app.get("/api/chirps", (req, res, next) => {
  Promise.resolve(handlerGetChirps(req, res)).catch(next);
});
app.get("/admin/metrics", handlerMetrics);
app.post("/admin/reset", (req, res, next) => {
  Promise.resolve(handlerReset(req, res)).catch(next);
});

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
 * Formats user data for API response, excluding sensitive fields
 * @param user - User record from database
 * @returns User data safe for API response
 */
function formatUserResponse(user: UserResponse): object {
  return {
    id: user.id,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    email: user.email,
  };
}

/**
 * Create user endpoint handler
 * Accepts email and password, hashes password, creates user in database
 */
async function handlerCreateUser(req: Request, res: Response): Promise<void> {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  await new Promise<void>((resolve) => {
    req.on("end", () => resolve());
  });

  const parsedBody = JSON.parse(body);
  
  if (!parsedBody.email || typeof parsedBody.email !== "string") {
    throw new BadRequestError("Invalid email");
  }

  if (!parsedBody.password || typeof parsedBody.password !== "string") {
    throw new BadRequestError("Invalid password");
  }

  const hashedPassword = await hashPassword(parsedBody.password);

  const user = await createUser({
    email: parsedBody.email,
    hashedPassword,
  });

  if (!user) {
    throw new BadRequestError("User with this email already exists");
  }

  res.status(201).json(formatUserResponse(user));
}

/**
 * Login endpoint handler
 * Accepts email, password, and optional expiresInSeconds
 * Returns user data with JWT token
 */
async function handlerLogin(req: Request, res: Response): Promise<void> {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  await new Promise<void>((resolve) => {
    req.on("end", () => resolve());
  });

  const parsedBody = JSON.parse(body);
  
  if (!parsedBody.email || typeof parsedBody.email !== "string") {
    throw new UnauthorizedError("Incorrect email or password");
  }

  if (!parsedBody.password || typeof parsedBody.password !== "string") {
    throw new UnauthorizedError("Incorrect email or password");
  }

  const user = await getUserByEmail(parsedBody.email);

  if (!user) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  const passwordMatch = await checkPasswordHash(parsedBody.password, user.hashedPassword);

  if (!passwordMatch) {
    throw new UnauthorizedError("Incorrect email or password");
  }

  const ONE_HOUR = 3600;
  let expiresIn = ONE_HOUR;

  if (parsedBody.expiresInSeconds !== undefined) {
    if (typeof parsedBody.expiresInSeconds !== "number") {
      throw new BadRequestError("Invalid expiresInSeconds");
    }
    expiresIn = Math.min(parsedBody.expiresInSeconds, ONE_HOUR);
  }

  const token = makeJWT(user.id, expiresIn, config.jwtSecret);

  res.status(200).json({
    ...formatUserResponse(user),
    token,
  });
}

/**
 * Create chirp endpoint handler
 * Requires JWT authentication
 * Accepts body, validates, cleans profanity, and creates chirp
 */
async function handlerCreateChirp(req: Request, res: Response): Promise<void> {
  const token = getBearerToken(req);
  const userId = validateJWT(token, config.jwtSecret);

  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  await new Promise<void>((resolve) => {
    req.on("end", () => resolve());
  });

  const parsedBody = JSON.parse(body);
  
  if (!parsedBody.body || typeof parsedBody.body !== "string") {
    throw new BadRequestError("Invalid request body");
  }

  if (parsedBody.body.length > 140) {
    throw new BadRequestError("Chirp is too long. Max length is 140");
  }

  const cleanedBody = cleanProfanity(parsedBody.body);

  const chirp = await createChirp({
    body: cleanedBody,
    userId: userId,
  });

  res.status(201).json({
    id: chirp.id,
    createdAt: chirp.createdAt.toISOString(),
    updatedAt: chirp.updatedAt.toISOString(),
    body: chirp.body,
    userId: chirp.userId,
  });
}

/**
 * Get all chirps endpoint handler
 * Returns all chirps ordered by creation date (oldest first)
 */
async function handlerGetChirps(req: Request, res: Response): Promise<void> {
  const chirps = await getAllChirps();

  const formattedChirps = chirps.map((chirp) => ({
    id: chirp.id,
    createdAt: chirp.createdAt.toISOString(),
    updatedAt: chirp.updatedAt.toISOString(),
    body: chirp.body,
    userId: chirp.userId,
  }));

  res.status(200).json(formattedChirps);
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
 * Resets the fileserver hit counter and deletes all data (dev only)
 */
async function handlerReset(req: Request, res: Response): Promise<void> {
  if (config.platform !== "dev") {
    throw new ForbiddenError("This endpoint is only available in development");
  }

  config.fileserverHits = 0;
  await deleteAllChirps();
  await deleteAllUsers();
  
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.send("OK");
}
