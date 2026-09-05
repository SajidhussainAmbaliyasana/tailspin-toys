---
description: 'Commenting, documentation, and code style standards'
applyTo: '**/*.ts,**/*.astro'
---

# Code Quality Standards

This document defines the commenting, documentation, and code style conventions for Tailspin Toys. Consistent standards make the codebase easier to navigate, maintain, and extend — both for human developers and for Copilot.

## Comment Philosophy

### Comment Intent, Not Mechanics

**Write comments that explain *why* code exists or the reasoning behind non-obvious decisions. Do NOT restate what the code already says.**

**BAD — comments that merely paraphrase the code:**
```ts
// Increment the counter
counter++;

// Check if the value is greater than zero
if (value > 0) {
  // ...
}
```

**GOOD — comments that explain intent:**
```ts
// Start at 1 to account for off-by-one indexing in the CSV parser
counter++;

// Ratings below 1.0 are invalid and indicate a parsing error; skip them
if (value > 0) {
  // ...
}
```

### Types of Comments Worth Writing

1. **Reasoning**: Explain why a non-obvious approach was chosen
   ```ts
   // Use a stable hash instead of Math.random() to ensure
   // static builds are reproducible across multiple runs
   export function ratingFromTitle(title: string): number {
     // ...
   }
   ```

2. **Gotchas or edge cases**: Highlight tricky conditions or subtleties
   ```ts
   // Handle CRLF by skipping the paired \n after \r
   if (char === '\r' && content[i + 1] === '\n') {
     i++;
   }
   ```

3. **Non-standard patterns**: Explain why a conventional approach isn't used
   ```ts
   // Inject db as a parameter so helpers are testable with
   // an in-memory database, not dependent on the real client
   export async function getAllGames(db: Database): Promise<Game[]> {
   ```

### Keep Comments Current

Treat outdated comments as bugs. When code changes, review and update or delete related comments in the same change. Never leave comments that contradict the actual code behaviour.

## TypeScript Type Annotations

### Required: Explicit Types for Functions

All exported functions in `db/` and `src/lib/` must have explicit parameter and return type annotations. This ensures type safety, aids refactoring, and helps Copilot generate correct code.

**BAD:**
```ts
export function parseGamesCsv(content) {
  // ...
}

export async function getAllGames(db) {
  // ...
}
```

**GOOD:**
```ts
export function parseGamesCsv(content: string): GameCsvRow[] {
  // ...
}

export async function getAllGames(db: Database): Promise<Game[]> {
  // ...
}
```

### Avoid `any`

Never use `any` in exported APIs. Use `unknown` with a type guard if the type truly cannot be known statically, or use a union type if there are multiple valid types.

## Documentation Standards

### TSDoc/JSDoc for Exported Functions in `db/` and `src/lib/`

Every exported function must have a TSDoc or JSDoc comment describing its purpose, parameters, and return value. This is especially important for data-access helpers and transforms that are used by multiple pages.

**Pattern:**
```ts
/**
 * [One-line summary of what the function does]
 *
 * [Longer description if needed, including rationale for unusual patterns
 *  or important side effects]
 *
 * @param [name] [description]
 * @returns [description of return value]
 *
 * @example
 * const games = await getAllGames(db);
 * const titles = games.map(g => g.title);
 */
export async function getAllGames(db: Database): Promise<Game[]> {
  // ...
}
```

**Examples from the codebase:**

```ts
/**
 * Deterministically derive a star rating in [3.0, 5.0] (one decimal place)
 * from the game title. Using a stable hash instead of Math.random() keeps
 * static builds reproducible.
 *
 * @param title The game title to hash
 * @returns A star rating between 3.0 and 5.0
 */
export function ratingFromTitle(title: string): number {
  // ...
}
```

```ts
/**
 * Minimal RFC-4180-style CSV parser supporting quoted fields, escaped quotes
 * (""), and newlines inside quoted values. Returns rows keyed by header name.
 *
 * @param content Raw CSV text
 * @returns Array of records, each a map of column name to value
 */
export function parseCsv(content: string): Record<string, string>[] {
  // ...
}
```

### Documentation for Astro Component Props

Each reusable `.astro` component should document its `Props` interface so the component API is self-explanatory. Document individual prop fields with JSDoc comments:

**Pattern:**
```astro
---
interface Props {
  /** The game object containing all details (id, title, description, etc). */
  game: Game;
  /** Optional CSS class to apply to the root element. */
  class?: string;
}

const { game, class: className } = Astro.props;
---

<article class={className}>
  <!-- content -->
</article>
```

**Example:**
```astro
---
import type { Game } from '../types/game';

interface Props {
  /** The game to display in the card. */
  game: Game;
  /** Optional additional CSS classes for styling. */
  class?: string;
}

const { game, class: className } = Astro.props;
---

<div class={className} data-testid="game-card-{game.id}">
  <h3>{game.title}</h3>
  <p>{game.description}</p>
</div>
```

### Module-Level Documentation

If a file exports multiple related items, include a module-level JSDoc comment at the top describing the file's purpose:

```ts
/**
 * Pure, side-effect-free helpers for turning the seed CSV into database
 * records. Kept separate from any database access so they can be unit tested
 * in isolation and reused by the seed script.
 */

export interface GameCsvRow {
  // ...
}
```

## TypeScript Formatting Rules

### Spacing and Indentation

- Use **2 spaces** for indentation (enforced by ESLint and Prettier where configured).
- Include blank lines between logical sections of code to improve readability.

### Type Definitions

- Use `type` for type aliases (data shapes).
- Use `interface` for object shapes that may be extended or implemented (rare in this codebase).
- Prefer inferred types from Drizzle (`typeof table.$inferSelect`) over hand-written row types.

**Good:**
```ts
type Game = {
  id: number;
  title: string;
  description: string;
};

type GameCsvRow = {
  title: string;
  category: string;
};
```

### Import Statements

- Group imports by category: external packages, then relative paths.
- Sort imports alphabetically within each group.
- Use absolute imports where sensible; relative imports for local code.

**Good:**
```ts
import { eq, asc } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories } from '../../db/schema';
import type { Game } from '../types/game';
```

### Naming Conventions

- Use **camelCase** for variables, functions, and object properties.
- Use **PascalCase** for types, interfaces, and class names.
- Use **UPPER_SNAKE_CASE** for constants.
- Prefix boolean variables with `is`, `has`, or `should` where the intent is clear.

```ts
const MAX_RETRIES = 3;
const CROWDFUNDING_BLURB = '...';

let isLoading = false;
let hasError = false;
```

## ESLint Enforcement

The project runs ESLint (`npm run lint`) with the following rules:

- **TypeScript-eslint recommended rules** — enforces best practices.
- **No unused variables** — prefixed with `_` if intentional (e.g., `const _unused = value;`).
- **Astro plugin recommendations** — enforces Astro-specific best practices.

Before committing, run the **quality-checks skill** to verify linting passes:

```bash
# via the skill (recommended)
/quality-checks

# or directly
npm run lint
```

## Testing and Validation

All code changes must be validated:

1. **Unit tests** (`npm run test:unit`): Cover data-layer logic, transforms, and helpers.
2. **Type checking** (`npm run typecheck` + `npm run typecheck:astro`): Verify TypeScript correctness.
3. **Linting** (`npm run lint`): Enforce code style and quality rules.
4. **E2E tests** (`npm run test:e2e`): Verify feature completeness.

Use the **quality-checks skill** to run all checks at once — it wraps environment setup, ordering, and troubleshooting.

## Summary

| Rule | Who | Why |
| --- | --- | --- |
| Comment *why*, not *what* | All | Avoid redundant noise; focus on intent |
| Explicit types on exported functions | `db/`, `src/lib/` | Enable refactoring, type safety, Copilot accuracy |
| TSDoc/JSDoc for exports | `db/`, `src/lib/` | Make APIs self-documenting |
| Props documentation | `.astro` components | Make component interfaces clear |
| Keep comments current | All | Prevent confusion and bugs |
| Run linting before commit | All | Catch style issues early |
