import { db } from "../index.js";
import { NewUser, users, UserResponse } from "../schema.js";
import { eq } from "drizzle-orm";

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

/**
 * Retrieves a user by email address
 * @param email - Email address to search for
 * @returns The user record, or undefined if not found
 */
export async function getUserByEmail(email: string) {
  const [result] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  return result;
}

/**
 * Updates a user's email and password
 * @param userId - User ID to update
 * @param email - New email address
 * @param hashedPassword - New hashed password
 * @returns Updated user record
 */
export async function updateUser(userId: string, email: string, hashedPassword: string) {
  const [result] = await db
    .update(users)
    .set({
      email,
      hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return result;
}

/**
 * Deletes all users from the database
 * @returns Number of users deleted
 */
export async function deleteAllUsers() {
  const result = await db.delete(users);
  return result;
}
