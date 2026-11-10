// Integration tests: real Nest app over HTTP, real Postgres (minihive_test).
// Only the Cognito signature check is swapped out. Needs `docker compose up`.
// Run with: npm run test:int -w api

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { Injectable, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import pg from "pg";

const ROOT = join(import.meta.dirname, "../../../..");
// Jest sandboxes process.env, so process.loadEnvFile() wouldn't reach it
Object.assign(process.env, parseEnv(readFileSync(join(ROOT, ".env"), "utf8")));
process.env.COGNITO_USER_POOL_ID ??= "eu-west-1_test";
process.env.COGNITO_CLIENT_ID ??= "test";

const devUrl = new URL(process.env.DATABASE_URL!);
const testUrl = new URL(devUrl);
testUrl.pathname = "/minihive_test";
process.env.DATABASE_URL = testUrl.toString();

// Imported after DATABASE_URL points at the test database
const { AppModule } = await import("../app.module.js");
const { AuthGuard } = await import("../auth/auth.js");

// The bearer token is just the user's sub, e.g. "Bearer s-bob"
@Injectable()
class TestAuthGuard extends AuthGuard {
  protected override async verifyToken(token: string) {
    return { sub: token, groups: token === "s-alice" ? ["platform_admin"] : [] };
  }
}

const GARAGE_A = "10000000-0000-4000-8000-000000000001";
const GARAGE_B = "10000000-0000-4000-8000-000000000002";
const LICENCE_A = "30000000-0000-4000-8000-000000000001"; // 2 seats, active, Carol holds one
const LICENCE_B = "30000000-0000-4000-8000-000000000002"; // expired
const LICENCE_RACE = "30000000-0000-4000-8000-0000000000aa"; // 1 seat, created below
const id = (n: number) => `40000000-0000-4000-8000-00000000000${n}`;
const [BOB, CAROL, DAVE, ERIN] = [2, 3, 4, 5].map(id);

let app: INestApplication;
let baseUrl: string;

async function call(as: string, method: string, path: string, body?: object) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer s-${as}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const assignSeat = (as: string, licenceId: string, userId: string) =>
  call(as, "POST", `/licences/${licenceId}/seats`, { userId });

beforeAll(async () => {
  // Fresh test database from the real migrations and seed
  const admin = new pg.Client({ connectionString: devUrl.toString() });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS minihive_test");
  await admin.query("CREATE DATABASE minihive_test");
  await admin.end();

  const env = { ...process.env, DATABASE_URL: testUrl.toString() };
  execFileSync("node", ["infra/db/migrate.ts"], { cwd: ROOT, env });
  execFileSync("node", ["infra/db/seed.ts"], { cwd: ROOT, env });

  const db = new pg.Client({ connectionString: testUrl.toString() });
  await db.connect();
  await db.query(
    `INSERT INTO users (id, idp_sub, email, name)
     SELECT ('40000000-0000-4000-8000-00000000000' || n)::uuid, 's-' || name, name || '@minihive.test', name
     FROM unnest(ARRAY[1,2,3,4,5], ARRAY['alice','bob','carol','dave','erin']) AS t(n, name)`,
  );
  await db.query(
    `INSERT INTO memberships (user_id, org_id, role) VALUES
       ($1, $5, 'org_admin'), ($2, $5, 'member'), ($3, $5, 'member'),
       ($4, $6, 'org_admin')`,
    [BOB, CAROL, DAVE, ERIN, GARAGE_A, GARAGE_B],
  );
  await db.query("INSERT INTO seat_assignments (licence_id, user_id) VALUES ($1, $2)", [LICENCE_A, CAROL]);
  await db.query(
    `INSERT INTO licences (id, org_id, product_id, seats, valid_from, valid_to)
     SELECT $1, $2, id, 1, now() - interval '1 day', now() + interval '1 year'
     FROM products WHERE code = 'SERVICE_BOOK'`,
    [LICENCE_RACE, GARAGE_A],
  );
  await db.end();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AuthGuard)
    .useClass(TestAuthGuard)
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = (await app.getUrl()).replace("[::1]", "localhost");
}, 30_000);

afterAll(async () => {
  await app?.close();
});

describe("access", () => {
  test("an org admin can't see another org (IDOR) → 404", async () => {
    const res = await call("bob", "GET", `/orgs/${GARAGE_B}/users`);
    expect(res.status).toBe(404);
  });

  test("a member can't assign seats → 403", async () => {
    const res = await assignSeat("carol", LICENCE_A, DAVE);
    expect(res.status).toBe(403);
  });
});

describe("seat rules", () => {
  test("assigns a free seat, then rejects a duplicate and a full licence", async () => {
    expect((await assignSeat("bob", LICENCE_A, DAVE)).status).toBe(201);

    const duplicate = await assignSeat("bob", LICENCE_A, DAVE);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toBe("user already has a seat on this licence");

    const full = await assignSeat("bob", LICENCE_A, BOB);
    expect(full.status).toBe(409);
    expect(full.body.message).toBe("no free seats on this licence");
  });

  test("rejects a seat on an expired licence", async () => {
    const res = await assignSeat("alice", LICENCE_B, ERIN);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("licence is not active");
  });

  test("rejects a user who isn't a member of the licence's org", async () => {
    const res = await assignSeat("bob", LICENCE_A, ERIN);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("user is not a member of this organisation");
  });

  // Forces the overlap instead of hoping parallel requests hit it: the first
  // transaction takes the last seat but doesn't commit while the second one runs.
  test("two concurrent assigns can't both take the last seat", async () => {
    const first = new pg.Client({ connectionString: testUrl.toString() });
    const second = new pg.Client({ connectionString: testUrl.toString() });
    await Promise.all([first.connect(), second.connect()]);

    try {
      await first.query("BEGIN");
      await first.query("SELECT assign_seat($1, $2, NULL)", [LICENCE_RACE, CAROL]);

      // With the row lock this blocks until `first` commits; without it, it would succeed
      const secondAttempt = second
        .query("SELECT assign_seat($1, $2, NULL)", [LICENCE_RACE, DAVE])
        .then(() => "assigned", (err: Error) => err.message);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await first.query("COMMIT");

      expect(await secondAttempt).toBe("no free seats on this licence");

      const licences = await call("bob", "GET", `/orgs/${GARAGE_A}/licences`);
      const race = licences.body.find((l: { id: string }) => l.id === LICENCE_RACE);
      expect(race.used).toBe(1);
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  });
});
