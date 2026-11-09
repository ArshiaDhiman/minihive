import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import pg from "pg";

// Injection token for the shared pg Pool
export const DB = Symbol("DB");

function createPool(): pg.Pool {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 2000, // don't hang if Postgres is down
  });

  // Unhandled idle-client errors would crash the process
  pool.on("error", (err) => {
    new Logger("Database").error(`idle connection lost: ${err.message}`);
  });

  return pool;
}

@Global()
@Module({
  providers: [{ provide: DB, useFactory: createPool }],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.end();
  }
}
