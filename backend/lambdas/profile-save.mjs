/**
 * profile-save — Creates or updates the authenticated user's profile.
 *
 * PUT /profile
 * Headers: Authorization: Bearer <jwt>
 * Body:    { firstName, lastName, dob, heightInches?, sex?, zipCode?, photo?, referenceUrl? }
 * Returns: { ok: true }
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

export const handler = async (event) => {
  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" });

    const body = parseBody(event.body);
    const { firstName, lastName, dob, heightInches, sex, zipCode, photo, referenceUrl } = body;

    if (!firstName && !lastName) {
      return reply(400, { error: "At least one of firstName or lastName is required" });
    }

    const now = new Date().toISOString();

    const item = {
      PK:        `USER#${userId}`,
      SK:        "#PROFILE",
      itemType:  "UserProfile",
      userId,
      firstName: (firstName ?? "").trim(),
      lastName:  (lastName ?? "").trim(),
      dob:       dob          ?? null,
      updatedAt: now,
    };

    if (heightInches  !== undefined) item.heightInches  = heightInches;
    if (sex           !== undefined) item.sex           = sex;
    if (zipCode       !== undefined) item.zipCode       = (zipCode ?? "").trim() || null;
    if (photo         !== undefined) item.photo         = photo;
    // Only store referenceUrl if provided (used for content contributor bio links)
    if (referenceUrl  !== undefined) item.referenceUrl  = (referenceUrl ?? "").trim() || null;

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    return reply(200, { ok: true });

  } catch (err) {
    console.error("profile-save error:", err);
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
