/**
 * goal-delete — Permanently remove a Goal.
 *
 * DELETE /goal
 * Headers: Authorization: Bearer <jwt>
 * Body:    { goalId }
 * Returns: { ok: true, goalId }
 *
 * Ownership is enforced implicitly: the delete key is scoped to the
 * authenticated user's partition (PK = "USER#<userId>"), so a user
 * can never delete another user's goal regardless of goalId supplied.
 *
 * Idempotent — deleting a non-existent goal returns 200.
 */

import { DynamoDBClient }                   from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,
         DeleteCommand }                     from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                         from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  };

  // Support API Gateway payload format v1 (httpMethod) and v2 (requestContext.http.method)
  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (method !== "DELETE") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body     = parseBody(event.body);
    const { goalId } = body;

    if (!goalId || !/^g-[a-z0-9-]+$/.test(goalId)) {
      return reply(400, { error: "goalId is required and must be a valid goal identifier." }, corsHeaders);
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `GOAL#${goalId}` },
    }));

    return reply(200, { ok: true, goalId }, corsHeaders);

  } catch (err) {
    console.error("goal-delete error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

function parseBody(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

async function authenticate(event) {
  try {
    const auth  = event.headers?.authorization || event.headers?.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function reply(statusCode, body, headers) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}
