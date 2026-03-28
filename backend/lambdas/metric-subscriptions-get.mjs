/**
 * metric-subscriptions-get — Returns all metrics the current user is subscribed to,
 * enriched with their full definitions.
 *
 * GET /subscriptions
 * Headers: Authorization: Bearer <jwt>
 * Returns: { subscriptions: Array<MetricDefinition & { subscribedAt: string }> }
 *
 * Called at login to hydrate metricConfig and cardDefinitions in the frontend.
 * Each item in the array is the full metric definition merged with the
 * subscription metadata (subscribedAt), ready for the UI to consume.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

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

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    // 1. Fetch all MetricSubscription items for this user.
    //    PK = "USER#<userId>", SK begins_with "METRIC#"
    const { Items: subs = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "METRIC#",
      },
    }));

    if (subs.length === 0) {
      return reply(200, { subscriptions: [] }, corsHeaders);
    }

    // 2. Batch-fetch the corresponding MetricDefinition items.
    //    Subscription SK = "METRIC#<id>" === Definition PK, so we re-use it directly.
    const keys = subs.map(s => ({ PK: s.SK, SK: "#DEF" }));

    const { Responses = {} } = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [TABLE]: { Keys: keys },
      },
    }));

    const defsByMetricId = {};
    for (const item of (Responses[TABLE] ?? [])) {
      defsByMetricId[item.metricId] = item;
    }

    // 3. Merge subscription metadata with definition fields.
    //    Drop any orphaned subscriptions whose definition no longer exists.
    const subscriptions = subs
      .map(sub => {
        const metricId = sub.SK.replace("METRIC#", "");
        const def      = defsByMetricId[metricId];
        if (!def) return null;
        const { PK, SK, itemType, ...defFields } = def;
        return {
          ...defFields,
          metricId,
          subscribedAt:        sub.subscribedAt,
          currentDailyStreak:  sub.currentDailyStreak  ?? 0,
          currentWeeklyStreak: sub.currentWeeklyStreak ?? 0,
        };
      })
      .filter(Boolean);

    return reply(200, { subscriptions }, corsHeaders);

  } catch (err) {
    console.error("metric-subscriptions-get error:", err);
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
