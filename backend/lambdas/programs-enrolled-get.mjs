/**
 * programs-enrolled-get — Return all Program enrolments for the authenticated user.
 *
 * GET /programs/enrolled[?active=true]
 * Headers: Authorization: Bearer <jwt>
 *
 * Query params:
 *   active — "true" (default) returns only active enrolments;
 *             "false" returns all (including unenrolled history)
 *
 * Returns:
 * {
 *   enrollments: Enrollment[]
 * }
 *
 * DynamoDB:
 *   Query PK = "USER#<userId>", SK begins_with "ENROLLMENT#"
 *
 * The Enrollment items snapshot programName and programType at enrolment time,
 * so the frontend can display and enforce goal-locking without re-fetching
 * the Program definition on every load.
 */

import { DynamoDBClient }                   from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,
         QueryCommand }                      from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                         from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (method !== "GET")     return reply(405, { error: "Method not allowed" }, corsHeaders);

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const qs           = event.queryStringParameters || {};
    // Default to returning only active enrolments; pass active=false for full history
    const activeOnly   = qs.active !== "false";

    const { Items: rawItems = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "ENROLLMENT#",
      },
    }));

    const enrollments = rawItems
      .map(({ PK, SK, itemType, ...rest }) => rest)
      .filter(e => !activeOnly || e.isActive !== false);

    return reply(200, { enrollments }, corsHeaders);

  } catch (err) {
    console.error("programs-enrolled-get error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

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
