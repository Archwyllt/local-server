import { db } from "../index.js";
import { NewUser, users } from "../schema.js";

/**
 * Creates a new user in the database
 * @param user - User data to insert
 * @returns The created user record, or undefined if conflict occurred
 */
export async function createUser(user: NewUser) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();
  return result;
}
