/**
 * Database connection and client factory for Drizzle ORM + Node SQLite.
 *
 * Provides both programmatic database access (for pages and tests) and
 * raw SQLite access (for migrations). Uses a singleton pattern to cache
 * the connection across multiple build-time queries.
 */

import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { AsyncRemoteCallback, SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import * as schema from '../../db/schema';

export type Database = SqliteRemoteDatabase<typeof schema>;

export interface DatabaseConnection {
    db: Database;
    sqlite: DatabaseSync;
}

/** Default local SQLite file used for dev/build when DATABASE_URL is unset. */
const DEFAULT_DATABASE_URL = 'file:tailspin.db';

let cachedDb: Database | undefined;

/** Resolve a local SQLite URL to the path expected by Node's built-in driver.
 *
 * @param url Database URL (e.g., 'file:tailspin.db', ':memory:', or 'file:///absolute/path.db')
 * @returns The filesystem path or ':memory:' for in-memory databases
 * @throws Error if URL is not a valid file: URL or :memory:
 */
function databasePath(url: string): string {
    if (url === ':memory:') {
        return url;
    }

    if (!url.startsWith('file:')) {
        throw new Error('DATABASE_URL must be a local file: URL or :memory:.');
    }

    const filePath = url.startsWith('file://') ? fileURLToPath(url) : url.slice('file:'.length);
    if (!filePath) {
        throw new Error('DATABASE_URL must include a database file path.');
    }

    mkdirSync(dirname(filePath), { recursive: true });
    return filePath;
}

/** Bridge Drizzle's async SQLite adapter to Node's synchronous built-in driver.
 *
 * Wraps Node's synchronous DatabaseSync in an async callback so Drizzle can
 * issue queries using its promise-based API without blocking the event loop.
 *
 * @param sqlite The synchronous Node SQLite database connection
 * @returns An async callback function that Drizzle uses to execute SQL
 */
function createRemoteCallback(sqlite: DatabaseSync): AsyncRemoteCallback {
    return async (sql: string, params: SQLInputValue[], method: 'run' | 'all' | 'values' | 'get') => {
        const statement = sqlite.prepare(sql);

        switch (method) {
            case 'run':
                statement.run(...params);
                return { rows: [] };
            case 'all':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'values':
                return { rows: statement.all(...params).map((row) => Object.values(row)) };
            case 'get': {
                const row = statement.get(...params);
                // Drizzle's proxy type requires an array, but its get mapper accepts no row.
                return { rows: row === undefined ? (undefined as unknown as never[]) : Object.values(row) };
            }
        }
    };
}

/** Run generated migration statements atomically through Node's SQLite driver.
 *
 * Wraps all migrations in a transaction so they succeed or fail as one unit.
 * Used by drizzle-kit during schema migrations.
 *
 * @param sqlite The synchronous Node SQLite database connection
 * @param queries Array of SQL statements to execute
 * @throws Error if any query fails; database is rolled back atomically
 */
export function executeMigrationQueries(sqlite: DatabaseSync, queries: string[]): void {
    sqlite.exec('BEGIN');
    try {
        for (const query of queries) {
            sqlite.exec(query);
        }
        sqlite.exec('COMMIT');
    } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
    }
}

/** Create a Drizzle client for the given local SQLite connection URL.
 *
 * @param url Database URL; defaults to DATABASE_URL env var or 'file:tailspin.db'
 * @returns A Drizzle ORM client configured for the SQLite database
 */
export function createDatabase(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): Database {
    return createDatabaseConnection(url).db;
}

/** Create the Drizzle client and its Node SQLite connection for migration workflows.
 *
 * Used by migration and seeding scripts that need both the ORM layer and
 * direct access to the SQLite connection for executing raw SQL.
 *
 * @param url Database URL; defaults to DATABASE_URL env var or 'file:tailspin.db'
 * @returns Object containing both the Drizzle client and the underlying Node SQLite connection
 */
export function createDatabaseConnection(
    url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
): DatabaseConnection {
    const sqlite = new DatabaseSync(databasePath(url));
    sqlite.exec('PRAGMA short_column_names = OFF; PRAGMA full_column_names = ON;');
    const db = drizzle(createRemoteCallback(sqlite), { schema });
    return { db, sqlite };
}

/** Shared singleton database client used by pages at build time.
 *
 * Caches the database connection so repeated calls in the build process
 * reuse the same connection, improving performance.
 *
 * @returns The cached Drizzle database client
 */
export function getDatabase(): Database {
    if (!cachedDb) {
        cachedDb = createDatabase();
    }
    return cachedDb;
}
