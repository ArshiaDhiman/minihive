// Consumes provisioning events from SQS and keeps RepairInfo's access table in sync.
// SQS is at-least-once, so the same event can arrive twice: each event id is
// recorded in the same transaction as the access change, and repeats are skipped.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda";

type ProvisioningEvent = {
  eventId: string; // outbox.id
  type: "SeatAssigned" | "SeatRevoked";
  payload: { userSub: string; productCode: string; licenceId: string };
};

const TABLE_NAME = process.env.TABLE_NAME!;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  for (const [index, record] of event.Records.entries()) {
    try {
      await processRecord(record);
    } catch (err) {
      console.error(`message ${record.messageId} failed`, err);
      // FIFO: stop here and hand back this message and everything after it, otherwise a
      // later event for the same user would overtake the failed one. Already processed
      // messages aren't retried.
      return {
        batchItemFailures: event.Records.slice(index).map((r) => ({ itemIdentifier: r.messageId })),
      };
    }
  }
  return { batchItemFailures: [] };
};

const processRecord = async (record: SQSRecord): Promise<void> => {
  const event = JSON.parse(record.body) as ProvisioningEvent;
  const { userSub, productCode, licenceId } = event.payload;
  const accessKey = { PK: `USER#${userSub}`, SK: `PRODUCT#${productCode}` };

  const change =
    event.type === "SeatAssigned"
      ? { Put: { TableName: TABLE_NAME, Item: { ...accessKey, licenceId, grantedAt: new Date().toISOString() } } }
      : { Delete: { TableName: TABLE_NAME, Key: accessKey } };

  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          // Fails if this event was already processed, which cancels the whole transaction
          {
            Put: {
              TableName: TABLE_NAME,
              Item: { PK: `EVENT#${event.eventId}`, SK: "EVENT", type: event.type },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          change,
        ],
      }),
    );
    console.log(`${event.type} ${event.eventId}: ${userSub} ${productCode}`);
  } catch (err) {
    if (isAlreadyProcessed(err)) {
      console.log(`duplicate ${event.eventId}, skipped`);
      return;
    }
    throw err;
  }
};

const isAlreadyProcessed = (err: unknown): boolean =>
  err instanceof Error &&
  err.name === "TransactionCanceledException" &&
  (err as { CancellationReasons?: { Code?: string }[] }).CancellationReasons?.[0]?.Code ===
    "ConditionalCheckFailed";
