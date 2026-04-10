/**
 * journey-save — Create or update a Journey (named collection of goalIds).
 *
 * PUT /journey
 * Headers: Authorization: Bearer <jwt>
 * Body: { journeyId?, name, description?, goalIds: string[] }
 *
 * Returns: { journey }
 *
 * DynamoDB:
 *   PK: USER#<userId>   SK: JOURNEY#<journeyId>
 *
 * - goalIds are stored as-is; goals are not modified.
 * - If journeyId is omitted a new one is generated.
 */

import { DynamoDBClient }                   from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,
         PutCommand }                        from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                         from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const JOURNEY_ID_RE = /^jrn-[a-z0-9]+$/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (method !== "PUT") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body = parseBody(event.body);
    const { journeyId: incomingId, name, description, goalIds } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return reply(400, { error: "name is required." }, corsHeaders);
    }

    if (!Array.isArray(goalIds) || goalIds.length === 0) {
      return reply(400, { error: "goalIds must be a non-empty array." }, corsHeaders);
    }

    // Validate each goalId looks like a goal identifier
    for (const gid of goalIds) {
      if (typeof gid !== "string" || !gid) {
        return reply(400, { error: "Each goalId must be a non-empty string." }, corsHeaders);
      }
    }

    const now        = new Date().toISOString();
    const journeyId  = (incomingId && JOURNEY_ID_RE.test(incomingId))
      ? incomingId
      : `jrn-${Date.now().toString(36)}`;

    const item = {
      PK:          `USER#${userId}`,
      SK:          `JOURNEY#${journeyId}`,
      itemType:    "Journey",
      journeyId,
      name:        name.trim().slice(0, 120),
      description: typeof description === "string" ? description.trim().slice(0, 300) : "",
      goalIds:     [...new Set(goalIds)],   // deduplicate
      createdBy:   userId,
      createdAt:   now,
      updatedAt:   now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    const { PK, SK, itemType, ...journey } = item;
    return reply(200, { journey }, corsHeaders);

  } catch (err) {
    console.error("journey-save error:", err);
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
