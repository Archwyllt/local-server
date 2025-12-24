import { db } from "../index.js";
import { NewChirp, chirps } from "../schema.js";
import { asc, eq } from "drizzle-orm";

/**
 * Creates a new chirp in the database
 * @param chirp - Chirp data to insert
 * @returns The created chirp record
 */
export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();
  return result;
}

/**
 * Retrieves all chirps from the database ordered by creation date
 * @param authorId - Optional author ID to filter by
 * @returns Array of chirps, oldest first
 */
export async function getAllChirps(authorId?: string) {
  if (authorId) {
    const results = await db
      .select()
      .from(chirps)
      .where(eq(chirps.userId, authorId))
      .orderBy(asc(chirps.createdAt));
    return results;
  }

  const results = await db
    .select()
    .from(chirps)
    .orderBy(asc(chirps.createdAt));
  return results;
}

/**
 * Retrieves a chirp by ID
 * @param chirpId - Chirp ID to search for
 * @returns The chirp record, or undefined if not found
 */
export async function getChirpById(chirpId: string) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, chirpId));
  return result;
}

/**
 * Deletes a chirp by ID
 * @param chirpId - Chirp ID to delete
 * @returns Deleted chirp record, or undefined if not found
 */
export async function deleteChirp(chirpId: string) {
  const [result] = await db
    .delete(chirps)
    .where(eq(chirps.id, chirpId))
    .returning();
  return result;
}

/**
 * Deletes all chirps from the database
 * @returns Number of chirps deleted
 */
export async function deleteAllChirps() {
  const result = await db.delete(chirps);
  return result;
}
