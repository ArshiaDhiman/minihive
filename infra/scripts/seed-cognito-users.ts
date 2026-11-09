// Creates the seed users in Cognito, then writes them into Postgres using the
// sub that Cognito generated. Safe to run more than once.
// Run after `npm run db:seed` (it needs the orgs and licence from seed.sql).

import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  UsernameExistsException,
} from "@aws-sdk/client-cognito-identity-provider";
import pg from "pg";

// Same ids as seed.sql
const GARAGE_A = "10000000-0000-4000-8000-000000000001";
const GARAGE_B = "10000000-0000-4000-8000-000000000002";
const GARAGE_A_REPAIR_INFO = "30000000-0000-4000-8000-000000000001";

const ALICE = "40000000-0000-4000-8000-000000000001";
const BOB = "40000000-0000-4000-8000-000000000002";
const CAROL = "40000000-0000-4000-8000-000000000003";
const DAVE = "40000000-0000-4000-8000-000000000004";
const ERIN = "40000000-0000-4000-8000-000000000005";

type SeedUser = {
  id: string;
  name: string;
  email: string;
  platformAdmin?: boolean;
  org?: { id: string; role: "org_admin" | "member" };
};

const USERS: SeedUser[] = [
  { id: ALICE, name: "Alice", email: "alice@minihive.test", platformAdmin: true },
  { id: BOB, name: "Bob", email: "bob@minihive.test", org: { id: GARAGE_A, role: "org_admin" } },
  { id: CAROL, name: "Carol", email: "carol@minihive.test", org: { id: GARAGE_A, role: "member" } },
  { id: DAVE, name: "Dave", email: "dave@minihive.test", org: { id: GARAGE_A, role: "member" } },
  { id: ERIN, name: "Erin", email: "erin@minihive.test", org: { id: GARAGE_B, role: "org_admin" } },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (is it in .env?)`);
  }
  return value;
}

// Creates the user in Cognito if they don't exist yet, and returns their sub.
async function ensureCognitoUser(
  cognito: CognitoIdentityProviderClient,
  userPoolId: string,
  password: string,
  user: SeedUser,
): Promise<string> {
  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        UserAttributes: [
          { Name: "email", Value: user.email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: user.name },
        ],
        MessageAction: "SUPPRESS", // don't send an invitation email
      }),
    );
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
  }

  // Permanent, so the user isn't forced to change it on first login.
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      Password: password,
      Permanent: true,
    }),
  );

  if (user.platformAdmin) {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: user.email,
        GroupName: "platform_admin",
      }),
    );
  }

  const { UserAttributes } = await cognito.send(
    new AdminGetUserCommand({ UserPoolId: userPoolId, Username: user.email }),
  );
  const sub = UserAttributes?.find((attr) => attr.Name === "sub")?.Value;
  if (!sub) {
    throw new Error(`Cognito returned no sub for ${user.email}`);
  }
  return sub;
}

async function main(): Promise<void> {
  const userPoolId = requireEnv("COGNITO_USER_POOL_ID");
  const password = requireEnv("SEED_USER_PASSWORD");
  const databaseUrl = requireEnv("DATABASE_URL");

  // Credentials come from AWS_PROFILE, region from AWS_REGION (both in .env).
  const cognito = new CognitoIdentityProviderClient({});

  const subs = new Map<string, string>();
  for (const user of USERS) {
    const sub = await ensureCognitoUser(cognito, userPoolId, password, user);
    subs.set(user.id, sub);
    console.log(`cognito  ${user.email.padEnd(22)} sub=${sub}`);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");

    for (const user of USERS) {
      // DO UPDATE: if the user pool was recreated, the subs are new.
      await client.query(
        `INSERT INTO users (id, idp_sub, email, name) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE
           SET idp_sub = EXCLUDED.idp_sub, email = EXCLUDED.email, name = EXCLUDED.name`,
        [user.id, subs.get(user.id), user.email, user.name],
      );

      if (user.org) {
        await client.query(
          `INSERT INTO memberships (user_id, org_id, role) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role`,
          [user.id, user.org.id, user.org.role],
        );
      }
    }

    // Carol holds a seat on Garage A's REPAIR_INFO licence, assigned by Bob.
    await client.query(
      `INSERT INTO seat_assignments (licence_id, user_id, assigned_by) VALUES ($1, $2, $3)
       ON CONFLICT (licence_id, user_id) DO NOTHING`,
      [GARAGE_A_REPAIR_INFO, CAROL, BOB],
    );

    await client.query("COMMIT");
    console.log("postgres users, memberships and seat seeded");
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
