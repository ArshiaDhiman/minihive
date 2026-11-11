// RepairInfo's API. It never calls MiniHive: it accepts the same Cognito tokens and
// answers from its own access table, which the provisioning events keep up to date.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import type { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const TABLE_NAME = process.env.TABLE_NAME!;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Created outside the handler so the JWKS cache survives between warm invocations
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  clientId: process.env.CLIENT_ID!,
  tokenUse: "access",
});

// Stand-in for the real product content
const SAMPLE_CONTENT =
  "VW Golf VII 2.0 TDI (2019): timing belt every 210,000 km or 10 years. Wheel bolts 120 Nm.";

export const handler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const token = event.headers.authorization?.replace("Bearer ", "") ?? "";

  let sub: string;
  try {
    ({ sub } = await verifier.verify(token));
  } catch {
    return json(401, { message: "Invalid or missing token" });
  }

  const { Item } = await db.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `USER#${sub}`, SK: "PRODUCT#REPAIR_INFO" } }),
  );
  if (!Item) {
    return json(403, { message: "No RepairInfo seat. Ask your organisation admin for one." });
  }

  return json(200, { licenceId: Item.licenceId, grantedAt: Item.grantedAt, content: SAMPLE_CONTENT });
};

const json = (statusCode: number, body: unknown): LambdaFunctionURLResult => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
