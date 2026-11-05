import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const SEED_FILE = join(import.meta.dirname, "seed.sql");

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (is it in .env?)");
  }

  const sql = await readFile(SEED_FILE, "utf8");

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("seeded");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
