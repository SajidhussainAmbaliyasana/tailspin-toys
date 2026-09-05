/**
 * Data-access helpers for game, category, and publisher queries.
 *
 * All functions accept an injected `db` parameter, enabling both production use
 * (with the real database) and testing (with an in-memory test database). This
 * pattern decouples business logic from database plumbing.
 *
 * Queries are ordered by title to ensure static builds are deterministic.
 */

import { eq, asc } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/** Transform a raw database row into the app-facing Game type.
 *
 * Handles null category and publisher relationships gracefully, returning
 * null for missing relations instead of undefined.
 *
 * @param row Raw database row from the games/categories/publishers join
 * @returns Typed Game object ready for use in pages and components
 */
function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

/** Build the base query for games with their category and publisher relations.
 *
 * Uses left joins to gracefully handle missing category or publisher
 * relationships; the mapGame function converts nulls to null relations.
 *
 * @param db The injected database client
 * @returns A Drizzle query builder (not yet executed)
 */
function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Retrieve all games ordered by title (ascending).
 *
 * @param db The injected database client (real in pages, in-memory in tests)
 * @returns Promise resolving to an array of games with their category and publisher relations, ordered by title
 *
 * @example
 * const games = await getAllGames(db);
 * console.log(games.map(g => g.title)); // ['Alpha Game', 'Beta Game', ...]
 */
export async function getAllGames(db: Database): Promise<Game[]> {
    const rows = await baseGamesQuery(db).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Retrieve all game IDs ordered by title.
 *
 * Typically used by Astro's getStaticPaths to pre-generate dynamic routes
 * for the static build without fetching full game objects.
 *
 * @param db The injected database client
 * @returns Promise resolving to an array of game IDs in title order
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** Retrieve a single game by ID with its relations.
 *
 * Used by dynamic game detail pages (e.g., /game/[id].astro) to fetch
 * a specific game's information at build time.
 *
 * @param db The injected database client
 * @param id The game ID to look up
 * @returns Promise resolving to the game object, or null if not found
 *
 * @example
 * const game = await getGameById(db, 42);
 * if (game) {
 *   console.log(game.title);
 * }
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
