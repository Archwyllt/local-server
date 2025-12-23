import type { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig;
};

export type APIConfig = {
  fileserverHits: number;
  db: DBConfig;
};

function envOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

export const config: APIConfig = {
  fileserverHits: 0,
  db: {
    url: envOrThrow("DB_URL"),
    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },
  },
};
