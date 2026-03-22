/**
 * profile-get — Fetches the authenticated user's profile.
 *
 * GET /profile
 * Headers: Authorization: Bearer <jwt>
 * Returns: { profile: UserProfile } or { profile: null } if not yet created
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

export const handler = async (event) => {
  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" });

    const { Item } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: "#PROFILE" },
    }));

    if (!Item) return reply(200, { profile: null });

    // Strip DynamoDB keys from the returned profile
    const { PK, SK, itemType, ...profile } = Item;
    return reply(200, { profile });

  } catch (err) {
    console.error("profile-get error:", err);
    return reply(500, { error: "Internal server error" });
  }
};

async function authenticate(event) {
  try {
    const auth = event.headers?.authorization || event.headers?.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.sub;
  } catch {
    return null;
  }
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
