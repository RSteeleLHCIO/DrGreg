/**
 * login-begin — Initiates WebAuthn passkey authentication.
 *
 * POST /auth/login/begin
 * Body:    { username: string }
 * Returns: { options: PublicKeyCredentialRequestOptionsJSON }
 *
 * Looks up the user's registered credentials and generates a challenge.
 * The challenge is stored in DynamoDB with a 5-minute TTL.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { generateAuthenticationOptions } from "@simplewebauthn/server";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const RP_ID       = process.env.RP_ID       || "localhost";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

export const handler = async (event) => {
  try {
    const body     = parseBody(event.body);
    const username = (body.username ?? "").trim().toLowerCase();
    if (!username) return reply(400, { error: "username is required" });

    // Look up userId from the username index
    const { Item: userIndex } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USERNAME#${username}`, SK: "#USER" },
    }));
    // Use a generic message — avoids revealing whether the username exists
    if (!userIndex) return reply(400, { error: "No passkey found for this username" });

    const { userId } = userIndex;

    // Fetch all registered credentials for this user
    const { Items: creds = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "CRED#",
      },
    }));

    if (creds.length === 0) return reply(400, { error: "No passkey found for this username" });

    // Build the allowCredentials list so the browser knows which passkeys are valid
    const allowCredentials = creds.map((c) => ({
      id:         c.credentialId,  // Base64URLString — v13 API
      transports: c.transports ?? [],
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "required",
      allowCredentials,
    });

    // Store challenge with 5-minute TTL, keyed by username
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK:        `PENDING_AUTH#${username}`,
        SK:        "#CHALLENGE",
        itemType:  "PendingAuth",
        challenge: options.challenge,
        userId,
        username,
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
    }));

    return reply(200, { options });
  } catch (err) {
    console.error("login-begin error:", err);
    return reply(500, { error: "Internal server error" });
  }
};

function parseBody(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin":  CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}
