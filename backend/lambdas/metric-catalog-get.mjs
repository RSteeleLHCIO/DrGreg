/**
 * metric-catalog-get — Returns metric definitions available to subscribe to,
 * including inactive subscriptions that can be re-activated.
 *
 * GET /metrics/catalog
 * Headers: Authorization: Bearer <jwt>
 * Returns: { metrics: Array<MetricDefinition & { reactivate?: true }> }
 *
 * Rules:
 *   - Returns all isPublic=true metrics (system/seed metrics)
 *   - Returns the caller's own personal metrics (createdBy = userId, isPublic = false)
 *   - Excludes metrics where the caller has an ACTIVE subscription (isActive = true)
 *   - Includes metrics where the caller has an INACTIVE subscription (isActive = false),
 *     flagged with reactivate: true so the UI can show "Re-activate" instead of "Add"
 *   - Excludes metrics with no definition (orphaned subscriptions are ignored)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
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

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    // 1. Scan for all MetricDefinition items visible to this user.
    //    SK = "#DEF" is unique to MetricDefinition items in this table.
    //    We include: all public metrics OR the caller's own personal metrics.
    const { Items: allDefs = [] } = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression:
        "SK = :def AND (#pub = :t OR createdBy = :uid)",
      ExpressionAttributeNames: {
        "#pub": "isPublic",
      },
      ExpressionAttributeValues: {
        ":def": "#DEF",
        ":t":   true,
        ":uid": userId,
      },
    }));

    // 2. Get this user's current subscriptions, including isActive status.
    const { Items: subs = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "METRIC#",
      },
      ProjectionExpression: "SK, isActive",
    }));

    // Build two sets: actively subscribed (exclude) and inactive (include as reactivate).
    const activeIds   = new Set();
    const inactiveIds = new Set();
    for (const s of subs) {
      const id = s.SK.replace("METRIC#", "");
      if (s.isActive === false) {
        inactiveIds.add(id);
      } else {
        activeIds.add(id);
      }
    }

    // 3. Strip DynamoDB keys; exclude active subscriptions; flag inactive ones.
    const available = allDefs
      .filter(d => !activeIds.has(d.metricId))
      .map(({ PK, SK, itemType, ...def }) => {
        if (inactiveIds.has(def.metricId)) {
          return { ...def, reactivate: true };
        }
        return def;
      });

    return reply(200, { metrics: available }, corsHeaders);

  } catch (err) {
    console.error("metric-catalog-get error:", err);
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
