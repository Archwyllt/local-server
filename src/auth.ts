import argon2 from "argon2";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

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
 * @throws Error if token is invalid or expired
 */
export function validateJWT(tokenString: string, secret: string): string {
  const decoded = jwt.verify(tokenString, secret) as JwtPayload;

  if (!decoded.sub || typeof decoded.sub !== "string") {
    throw new Error("Invalid token: missing or invalid subject");
  }

  return decoded.sub;
}

/**
 * Extracts bearer token from Authorization header
 * @param req - Express request object
 * @returns Token string without "Bearer " prefix
 * @throws Error if Authorization header is missing or invalid
 */
export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Authorization header missing");
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new Error("Invalid Authorization header format");
  }

  return parts[1];
}
