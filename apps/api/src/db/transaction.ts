import pg from "pg";

// Runs fn in a transaction tagged with the acting user, so the audit trigger
// can fill in changed_by. Rolls back if fn throws.
export async function inTransaction<T>(
  db: pg.Pool,
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    // set_config(..., true) = SET LOCAL, but accepts a bind parameter
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
