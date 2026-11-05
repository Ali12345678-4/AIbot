import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { getConnectionString } from "@netlify/database";

const globalForPool = globalThis as unknown as { __pgPool?: Pool };

function createPool() {
  // Local dev uses DATABASE_URL; on Netlify the managed database is used automatically.
  let url = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
  if (!url) {
    try { url = getConnectionString(); } catch { /* falls through */ }
  }
  if (!url) throw new Error("No database configured. Set DATABASE_URL (see README.md).");
  const local = url.includes("localhost") || url.includes("127.0.0.1");
  return new Pool({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
}

export function pool(): Pool {
  if (!globalForPool.__pgPool) globalForPool.__pgPool = createPool();
  return globalForPool.__pgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await pool().query<T>(text, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const out = await fn(client);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
