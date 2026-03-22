/**
 * register-finish — Verifies the passkey credential and completes registration.
 *
 * POST /auth/register/finish
 * Body:    { userId: string, response: RegistrationResponseJSON }
 * Returns: { token: string, userId: string, username: string }
 *
 * On success:
 *   - Stores a Credential item  (USER#<userId> / CRED#<credentialId>)
 *   - Stores a UsernameIndex item (USERNAME#<username> / #USER)
 *   - Deletes the PendingRegistration challenge item
 *   - Returns a signed 7-day JWT
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { SignJWT } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE           = process.env.TABLE_NAME       || "TobbiHealth";
const RP_ID           = process.env.RP_ID            || "localhost";
const EXPECTED_ORIGIN = process.env.EXPECTED_ORIGIN  || "http://localhost:5173";
const CORS_ORIGIN     = process.env.CORS_ORIGIN      || "*";
const JWT_SECRET      = process.env.JWT_SECRET       || "";

export const handler = async (event) => {
  try {
    const { userId, response } = parseBody(event.body);
    if (!userId || !response) {
      return reply(400, { error: "userId and response are required" });
    }

    // Fetch the pending challenge (will be missing if expired via DynamoDB TTL)
    const { Item: pending } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `PENDING_REG#${userId}`, SK: "#CHALLENGE" },
    }));
    if (!pending) {
      return reply(400, { error: "Registration session not found or expired. Please start again." });
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin:    EXPECTED_ORIGIN,
      expectedRPID:      RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return reply(400, { error: "Passkey verification failed" });
    }

    // SimpleWebAuthn v13: credential details are under registrationInfo.credential
    const { credential } = verification.registrationInfo;
    const credentialId     = credential.id;           // already a Base64URLString in v13
    const credentialPubKey = toBase64url(credential.publicKey); // Uint8Array → base64url
    const now              = new Date().toISOString();

    // Write credential + username index, delete pending challenge — all in parallel
    await Promise.all([
      ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK:                  `USER#${userId}`,
          SK:                  `CRED#${credentialId}`,
          itemType:            "Credential",
          credentialId,
          credentialPublicKey: credentialPubKey,
          counter:             credential.counter ?? 0,
          transports:          credential.transports ?? [],
          username:            pending.username,
          userId,
          createdAt:           now,
        },
      })),
      ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          PK:        `USERNAME#${pending.username}`,
          SK:        "#USER",
          itemType:  "UsernameIndex",
          userId,
          username:  pending.username,
          createdAt: now,
        },
      })),
      ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `PENDING_REG#${userId}`, SK: "#CHALLENGE" },
      })),
    ]);

    const token = await signJwt(userId, pending.username);
    return reply(200, { token, userId, username: pending.username });
  } catch (err) {
    console.error("register-finish error:", err);
    return reply(500, { error: "Internal server error" });
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toBase64url(uint8array) {
  return Buffer.from(uint8array).toString("base64url");
}

async function signJwt(userId, username) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({ sub: userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

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
