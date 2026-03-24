/**
 * metric-entries-get — Retrieve metric entries for a date range across all
 * subscribed metrics (or a specific metric).
 *
 * GET /entries?from=<ts_ms>&to=<ts_ms>[&metric=<metricId>]
 *
 *   from   — start of range, Unix ms epoch (inclusive)
 *   to     — end of range,   Unix ms epoch (inclusive)
 *   metric — (optional) restrict results to this single metric
 *
 * Response:
 *   {
 *     entries: {
 *       [metricId]: [{ ts, value, updatedAt, source }, ...]
 *     }
 *   }
 *
 * Strategy:
 *   1. Authenticate caller, extract userId from JWT.
 *   2. If ?metric= given, query just that partition.
 *      Otherwise, get all active subscriptions and query them in parallel.
 *   3. Each partition query:
 *        PK = "USER#<userId>#METRIC#<metricId>"
 *        SK BETWEEN "TS#<from_padded>" AND "TS#<to_padded>"
 *   4. Return merged { entries: { ... } } object.
 *
 * Headers: Authorization: Bearer <jwt>
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const VALID_METRIC = /^[a-z0-9-]+$/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const qs   = event.queryStringParameters || {};
    const from = parseInt(qs.from, 10);
    const to   = parseInt(qs.to,   10);

    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      return reply(400, { error: "from and to must be finite ms-epoch numbers with from ≤ to." }, corsHeaders);
    }

    const skFrom = `TS#${String(from).padStart(16, "0")}`;
    const skTo   = `TS#${String(to).padStart(16, "0")}`;

    // Determine which metrics to query
    let metricIds;

    if (qs.metric) {
      if (!VALID_METRIC.test(qs.metric)) {
        return reply(400, { error: "metric must be lowercase letters, digits, and hyphens only." }, corsHeaders);
      }
      metricIds = [qs.metric];
    } else {
      // Query all active subscriptions for this user
      metricIds = await getActiveMetricIds(userId);
    }

    if (!metricIds.length) {
      return reply(200, { entries: {} }, corsHeaders);
    }

    // Parallel queries — one per metric partition
    const results = await Promise.all(
      metricIds.map((metricId) =>
        queryMetricRange(userId, metricId, skFrom, skTo)
      )
    );

    // Build response object; omit metrics with no entries in range
    const entries = {};
    for (let i = 0; i < metricIds.length; i++) {
      if (results[i].length > 0) {
        entries[metricIds[i]] = results[i];
      }
    }

    return reply(200, { entries }, corsHeaders);

  } catch (err) {
    console.error("metric-entries-get error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns an array of active metricId strings for the given user. */
async function getActiveMetricIds(userId) {
  const ids = [];
  let lastKey;

  // Paginate through all subscription items (SK begins_with "METRIC#")
  do {
    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      FilterExpression: "isActive = :active",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "METRIC#",
        ":active": true,
      },
      ExclusiveStartKey: lastKey,
      ProjectionExpression: "metricId",
    }));

    for (const item of Items ?? []) {
      if (item.metricId) ids.push(item.metricId);
    }
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  return ids;
}

/**
 * Query one metric partition for entries in [skFrom, skTo].
 * Returns an array of plain entry objects { ts, value, updatedAt, source }.
 */
async function queryMetricRange(userId, metricId, skFrom, skTo) {
  const items = [];
  let lastKey;

  do {
    const { Items, LastEvaluatedKey } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk":   `USER#${userId}#METRIC#${metricId}`,
        ":from": skFrom,
        ":to":   skTo,
      },
      ExclusiveStartKey: lastKey,
      ProjectionExpression: "ts, #val, updatedAt, #src",
      ExpressionAttributeNames: {
        "#val": "value",   // 'value' is a reserved word in DynamoDB expressions
        "#src": "source",
      },
    }));

    for (const item of Items ?? []) {
      items.push({
        ts:        item.ts,
        value:     item.value,
        updatedAt: item.updatedAt,
        source:    item.source,
      });
    }
    lastKey = LastEvaluatedKey;
  } while (lastKey);

  // Items come back in SK (chronological) order — no explicit sort needed.
  return items;
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
