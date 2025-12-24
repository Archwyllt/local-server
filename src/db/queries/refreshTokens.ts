import { db } from "../index.js";
import { NewRefreshToken, refreshTokens, users } from "../schema.js";
import { eq, and, isNull, gt } from "drizzle-orm";

/**
 * Creates a new refresh token in the database
 * @param refreshToken - Refresh token data to insert
 * @returns The created refresh token record
 */
export async function createRefreshToken(refreshToken: NewRefreshToken) {
  const [result] = await db
    .insert(refreshTokens)
    .values(refreshToken)
    .returning();
  return result;
}

/**
 * Gets user from a refresh token if valid (not expired or revoked)
 * @param token - Refresh token string
 * @returns User record if token is valid, undefined otherwise
 */
export async function getUserFromRefreshToken(token: string) {
  const [result] = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      hashedPassword: users.hashedPassword,
    })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date())
      )
    );
  return result;
}

/**
 * Revokes a refresh token by setting revokedAt timestamp
 * @param token - Refresh token string to revoke
 * @returns Updated refresh token record
 */
export async function revokeRefreshToken(token: string) {
  const [result] = await db
    .update(refreshTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(refreshTokens.token, token))
    .returning();
  return result;
}

/**
 * Deletes all refresh tokens from the database
 * @returns Number of tokens deleted
 */
export async function deleteAllRefreshTokens() {
  const result = await db.delete(refreshTokens);
  return result;
}
