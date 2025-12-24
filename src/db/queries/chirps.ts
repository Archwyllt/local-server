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
 * @returns Array of all chirps, oldest first
 */
export async function getAllChirps() {
  const results = await db
    .select()
    .from(chirps)
    .orderBy(asc(chirps.createdAt));
  return results;
}

/**
 * Retrieves a single chirp by its ID
 * @param id - The chirp ID to look up
 * @returns The chirp if found, undefined otherwise
 */
export async function getChirpById(id: string) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, id));
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
