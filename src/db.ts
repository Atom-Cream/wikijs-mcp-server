/**
 * Direct PostgreSQL connection for post-mutation author fixup.
 *
 * Wiki.js v2 always attributes GraphQL API page mutations to the admin account
 * that created the API key, regardless of which per-user key was used.  After
 * each successful create/update mutation we immediately patch the newest
 * pageHistory row for that page to reflect the real author.
 *
 * The pool is created lazily on first use and is a no-op when DB env vars are
 * not configured (graceful degradation — the mutation itself still succeeds).
 */

import pg from "pg";
const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (pool) return pool;

  const host = process.env.PG_HOST;
  if (!host) return null; // DB not configured — skip author fixup

  pool = new Pool({
    host,
    port: parseInt(process.env.PG_PORT || "5432"),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || "wiki",
    max: 3,
    idleTimeoutMillis: 30_000,
  });

  pool.on("error", (err) => {
    console.error("[DB] Unexpected pool error:", err.message);
  });

  return pool;
}

/**
 * Patch the most recent pageHistory row for `pageId` to set `authorId`.
 * Called immediately after a successful create or update mutation so the row
 * is already committed by Wiki.js.
 *
 * Silently skips if the DB pool is not configured or if the query fails
 * (the underlying page mutation has already succeeded).
 */
export async function fixPageAuthor(
  pageId: number,
  authorId: number
): Promise<void> {
  const db = getPool();
  if (!db) return;

  try {
    // Patch the pages table — this is what the Wiki.js UI displays as "last edited by"
    const pagesResult = await db.query(
      `UPDATE pages SET "authorId" = $1 WHERE id = $2`,
      [authorId, pageId]
    );

    // Patch the most recent pageHistory row — shown in the page history view
    const historyResult = await db.query(
      `UPDATE "pageHistory"
       SET "authorId" = $1
       WHERE id = (
         SELECT id FROM "pageHistory"
         WHERE "pageId" = $2
         ORDER BY id DESC
         LIMIT 1
       )`,
      [authorId, pageId]
    );

    console.log(
      `[DB] fixPageAuthor: pageId=${pageId} authorId=${authorId} → pages: ${pagesResult.rowCount} row(s), pageHistory: ${historyResult.rowCount} row(s)`
    );
  } catch (err: any) {
    console.error(`[DB] fixPageAuthor failed for pageId=${pageId}:`, err.message);
  }
}
