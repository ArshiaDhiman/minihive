// Outbox publisher: picks up events the API wrote to the outbox table and publishes them to SNS.
// Rows are only marked published after SNS accepts them. If we crash in between, the event is
// published again on the next run - consumers dedupe on eventId, so that's safe (at-least-once).

import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import pg from "pg";

type OutboxRow = { id: string; type: string; payload: { userSub: string } };

const TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 2000;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 2000,
});
// Unhandled idle-client errors would crash the process
pool.on("error", (err) => console.error(`idle connection lost: ${err.message}`));

const sns = new SNSClient({});

const publishPending = async (): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // SKIP LOCKED: if another worker is already holding some rows, take the next ones
    // instead of waiting for them or publishing them twice
    const { rows } = await client.query<OutboxRow>(
      `SELECT id, type, payload
         FROM outbox
        WHERE published_at IS NULL
        ORDER BY created_at
        LIMIT $1
          FOR UPDATE SKIP LOCKED`,
      [BATCH_SIZE],
    );

    // One at a time, in order. If one fails we stop, so a later event never overtakes it.
    for (const row of rows) {
      await sns.send(
        new PublishCommand({
          TopicArn: TOPIC_ARN,
          Message: JSON.stringify({ eventId: row.id, type: row.type, payload: row.payload }),
          // FIFO topic: events with the same group are delivered in order, one at a time.
          // Per user, so different users are still processed in parallel.
          MessageGroupId: row.payload.userSub,
          // SNS drops a repeat of the same event within 5 minutes
          MessageDeduplicationId: row.id,
        }),
      );
      console.log(`published ${row.type} ${row.id}`);
    }

    await client.query("UPDATE outbox SET published_at = now() WHERE id = ANY($1)", [
      rows.map((row) => row.id),
    ]);
    await client.query("COMMIT");
    return rows.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let running = true;

// Ctrl+C / container stop: finish the current batch, then exit
const stop = () => {
  running = false;
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log("worker started");

while (running) {
  try {
    const published = await publishPending();
    // A full batch means there's probably more waiting, so go again straight away
    if (published === BATCH_SIZE) continue;
  } catch (err) {
    console.error("publish failed, will retry", err);
  }
  await sleep(POLL_INTERVAL_MS);
}

await pool.end();
console.log("worker stopped");
