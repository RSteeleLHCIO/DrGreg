/**
 * login-finish — Verifies the passkey assertion and issues a session JWT.
 *
 * POST /auth/login/finish
 * Body:    { username: string, response: AuthenticationResponseJSON }
 * Returns: { token: string, userId: string, username: string }
 *
 * On success:
 *   - Verifies the signed challenge against the stored public key
 *   - Updates the credential's signature counter (replay-attack protection)
 *   - Deletes the PendingAuth challenge item
 *   - Returns a signed 7-day JWT
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { SignJWT } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE           = process.env.TABLE_NAME       || "TobbiHealth";
const RP_ID           = process.env.RP_ID            || "localhost";
const EXPECTED_ORIGIN = process.env.EXPECTED_ORIGIN  || "http://localhost:5173";
const CORS_ORIGIN     = process.env.CORS_ORIGIN      || "*";
const JWT_SECRET      = process.env.JWT_SECRET       || "";

export const handler = async (event) => {
  try {
    const { username, response } = parseBody(event.body);
    if (!username || !response) {
      return reply(400, { error: "username and response are required" });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Fetch the pending challenge for this username
    const { Item: pending } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `PENDING_AUTH#${cleanUsername}`, SK: "#CHALLENGE" },
    }));
    if (!pending) {
      return reply(400, { error: "Authentication session not found or expired. Please try again." });
    }

    const { userId } = pending;

    // The response.id identifies which credential was used
    const credentialId = response.id;  // base64url string from the browser

    // Fetch the matching credential for this user
    const { Item: cred } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: {
        PK: `USER#${userId}`,
        SK: `CRED#${credentialId}`,
      },
    }));
    if (!cred) {
      return reply(400, { error: "Passkey not recognised" });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin:    EXPECTED_ORIGIN,
      expectedRPID:      RP_ID,
      credential: {
        id:         cred.credentialId,   // Base64URLString — v13 API
        publicKey:  new Uint8Array(Buffer.from(cred.credentialPublicKey, "base64url")),
        counter:    cred.counter ?? 0,
        transports: cred.transports ?? [],
      },
    });

    if (!verification.verified) {
      return reply(401, { error: "Authentication failed" });
    }

    const { newCounter } = verification.authenticationInfo;

    // Update the counter and delete the pending challenge in parallel
    await Promise.all([
      ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { ...cred, counter: newCounter },
      })),
      ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `PENDING_AUTH#${cleanUsername}`, SK: "#CHALLENGE" },
      })),
    ]);

    const token = await signJwt(userId, cleanUsername);
    return reply(200, { token, userId, username: cleanUsername });
  } catch (err) {
    console.error("login-finish error:", err);
    return reply(500, { error: "Internal server error" });
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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
