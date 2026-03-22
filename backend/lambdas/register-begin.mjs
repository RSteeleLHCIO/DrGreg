/**
 * register-begin — Initiates WebAuthn passkey registration.
 *
 * POST /auth/register/begin
 * Body:    { username: string }
 * Returns: { options: PublicKeyCredentialCreationOptionsJSON, userId: string }
 *
 * Stores a temporary PendingRegistration item in DynamoDB (5-minute TTL)
 * keyed by the newly-generated userId.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { generateRegistrationOptions } from "@simplewebauthn/server";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME    || "TobbiHealth";
const RP_ID       = process.env.RP_ID         || "localhost";
const RP_NAME     = process.env.RP_NAME       || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN   || "*";

export const handler = async (event) => {
  try {
    const body     = parseBody(event.body);
    const username = (body.username ?? "").trim().toLowerCase();

    if (!username) return reply(400, { error: "username is required" });

    // Reject if username already taken
    const { Item: existing } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USERNAME#${username}`, SK: "#USER" },
    }));
    if (existing) return reply(409, { error: "Username is not available" });

    const userId = crypto.randomUUID();

    const options = await generateRegistrationOptions({
      rpName:    RP_NAME,
      rpID:      RP_ID,
      userID:    new TextEncoder().encode(userId),
      userName:  username,
      attestationType: "none",
      authenticatorSelection: {
        residentKey:      "required",
        userVerification: "required",
      },
    });

    // Store challenge with 5-minute TTL (DynamoDB TTL feature removes it automatically)
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK:        `PENDING_REG#${userId}`,
        SK:        "#CHALLENGE",
        itemType:  "PendingRegistration",
        challenge: options.challenge,
        username,
        userId,
        ttl: Math.floor(Date.now() / 1000) + 300,
      },
    }));

    return reply(200, { options, userId });
  } catch (err) {
    console.error("register-begin error:", err);
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
