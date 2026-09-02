// lib/save-with-fallback.ts
import { db, dbBackup } from "@/lib/firebase";

function isQuotaError(err: any) {
  return (
    err?.code === "resource-exhausted" ||
    err?.message?.toLowerCase?.().includes("quota")
  );
}

class TimeoutError extends Error {}

/**
 * Runs `operation(database)` against the live db first.
 * If it fails due to quota-exceeded
 * it retries the same operation against the backup db.
 */
export async function withDbFallback<T>(
  operation: (database: typeof db) => Promise<T>,
): Promise<T> {
  const runWithTimeout = (database: typeof db) =>
    Promise.race<T>([
      operation(database),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError("Operation timed out"))),
      ),
    ]);

  try {
    return await runWithTimeout(db);
  } catch (err: any) {
    if (isQuotaError(err) || err instanceof TimeoutError) {
      console.warn("Live Firebase failed (quota/timeout) — retrying with backup:", err);
      return await operation(dbBackup);
    }
    throw err;
  }
}