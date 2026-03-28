/**
 * goals-get — Retrieve all Goals for the authenticated user.
 *
 * GET /goals[?metric=<metricId>]
 * Headers: Authorization: Bearer <jwt>
 *
 * Query params:
 *   metric  — (optional) filter results to a single metricId
 *
 * Returns: { goals: Goal[] }
 *
 * DynamoDB:
 *   Query PK=USER#<userId>, SK begins_with "GOAL#"
 *   Optional client-side filter applied after retrieval.
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

  // Support API Gateway payload format v1 (httpMethod) and v2 (requestContext.http.method)
  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (method !== "GET") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const qs           = event.queryStringParameters || {};
    const metricFilter = qs.metric ?? null;

    if (metricFilter && !/^[a-z0-9-]+$/.test(metricFilter)) {
      return reply(400, { error: "metric must be lowercase letters, digits, and hyphens only." }, corsHeaders);
    }

    const { Items: rawGoals = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "GOAL#",
      },
    }));

    // Strip DynamoDB projection keys; optionally filter by metricId
    const goals = rawGoals
      .map(({ PK, SK, itemType, ...rest }) => rest)
      .filter(g => !metricFilter || g.metricId === metricFilter);

    return reply(200, { goals }, corsHeaders);

  } catch (err) {
    console.error("goals-get error:", err);
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
