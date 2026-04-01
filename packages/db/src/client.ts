import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export function createDb(connectionString: string): Database {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

function getDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error(
      'DATABASE_URL environment variable is required. ' +
        'Set it to your PostgreSQL connection string.',
    );
  }
  return url;
}

let _db: Database | undefined;

export function getDb(): Database {
  if (!_db) {
    _db = createDb(getDatabaseUrl());
  }
  return _db;
}

/** Singleton database instance. Throws if DATABASE_URL is not set. */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});
