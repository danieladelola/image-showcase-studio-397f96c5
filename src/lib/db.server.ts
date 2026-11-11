import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let cached: Sql | null = null;

function isWorkerRuntime() {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

function connect(): Sql {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL is not configured");
  return postgres(url, {
    ssl: process.env["DATABASE_SSL"] === "true" ? "require" : false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    fetch_types: false,
    onnotice: () => {},
  });
}

/**
 * Runs `fn` with a database connection. On the Worker runtime a socket cannot be
 * shared across requests, so each call opens and closes its own connection; in
 * Node (dev server) one connection is reused.
 */

export async function withDb<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  if (!isWorkerRuntime()) {
    cached ??= connect();
    return fn(cached);
  }
  const sql = connect();
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

export const toNumber = (v: unknown) => (v == null ? null : Number(v));

export type { Sql };
