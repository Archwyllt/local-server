import argon2 from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import { Request } from "express";
import { UnauthorizedError } from "./errors.js";

/**
 * Hashes a password using Argon2
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

/**
 * Verifies a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 */
export async function checkPasswordHash(password: string, hash: string): Promise<boolean> {
  return await argon2.verify(hash, password);
}

/**
 * Creates a JWT for a user
 * @param userID - User's unique identifier
 * @param expiresIn - Token lifetime in seconds
 * @param secret - Secret key for signing the token
 * @returns Signed JWT string
 */
export function makeJWT(userID: string, expiresIn: number, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;

  type Payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

  const payload: Payload = {
    iss: "chirpy",
    sub: userID,
    iat: iat,
    exp: exp,
  };

  return jwt.sign(payload, secret);
}

/**
 * Validates a JWT and extracts the user ID
 * @param tokenString - JWT to validate
 * @param secret - Secret key used to sign the token
 * @returns User ID from the token
 * @throws UnauthorizedError if token is invalid or expired
 */
export function validateJWT(tokenString: string, secret: string): string {
  try {
    const decoded = jwt.verify(tokenString, secret) as JwtPayload;

    if (!decoded.sub || typeof decoded.sub !== "string") {
      throw new UnauthorizedError("Invalid token: missing or invalid subject");
    }

    return decoded.sub;
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/**
 * Generates a random refresh token
 * @returns 256-bit hex-encoded random string
 */
export function makeRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Extracts bearer token from Authorization header
 * @param req - Express request object
 * @returns Token string without "Bearer " prefix
 * @throws UnauthorizedError if Authorization header is missing or invalid
 */
export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Authorization header missing");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedError("Invalid Authorization header format");
  }

  return parts[1];
}

/**
 * Extracts API key from Authorization header
 * @param req - Express request object
 * @returns API key string without "ApiKey " prefix
 * @throws UnauthorizedError if Authorization header is missing or invalid
 */
export function getAPIKey(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Authorization header missing");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "ApiKey") {
    throw new UnauthorizedError("Invalid Authorization header format");
  }

  return parts[1];
}
