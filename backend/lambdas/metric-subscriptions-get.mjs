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
        const dStatus = dailyStreakStatus(sub.lastEntryDate);
        const wStatus = weeklyStreakStatus(sub.lastEntryWeek);
        const liveDaily  = dStatus === 'active' || dStatus === 'jeopardy';
        const liveWeekly = wStatus === 'active' || wStatus === 'jeopardy';
        return {
          ...defFields,
          metricId,
          subscribedAt:        sub.subscribedAt,
          currentDailyStreak:  liveDaily  ? (sub.currentDailyStreak  ?? 0) : 0,
          currentWeeklyStreak: liveWeekly ? (sub.currentWeeklyStreak ?? 0) : 0,
          lastDailyStreak:     sub.currentDailyStreak  ?? 0,
          lastWeeklyStreak:    sub.currentWeeklyStreak ?? 0,
          maxDailyStreak:      sub.maxDailyStreak      ?? 0,
          maxWeeklyStreak:     sub.maxWeeklyStreak     ?? 0,
          lastEntryDate:       sub.lastEntryDate       ?? null,
          dailyStreakStatus:   dStatus,
          weeklyStreakStatus:  wStatus,
        };
      })
      .filter(Boolean);

    return reply(200, { subscriptions }, corsHeaders);

  } catch (err) {
    console.error("metric-subscriptions-get error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

// ── Streak status helpers ────────────────────────────────────────────────────
// Each returns: 'active' | 'jeopardy' | 'recently_ended' | 'dead'
//
//  active         — logged today (daily) / this week (weekly)  → streak is safe
//  jeopardy       — logged yesterday / last week               → streak dies if nothing logged today/this week
//  recently_ended — logged 2 days ago / 2 weeks ago            → streak just ended; prompt to restart
//  dead           — no entry, or older than the above windows

function toISODate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function toISOWeek(ts) {
  const d = new Date(ts);
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function dailyStreakStatus(lastEntryDate) {
  if (!lastEntryDate) return 'dead';
  const now          = Date.now();
  const today        = toISODate(now);
  const yesterday    = toISODate(now - 86_400_000);
  const twoDaysAgo   = toISODate(now - 2 * 86_400_000);
  if (lastEntryDate === today)      return 'active';
  if (lastEntryDate === yesterday)  return 'jeopardy';
  if (lastEntryDate === twoDaysAgo) return 'recently_ended';
  return 'dead';
}

function weeklyStreakStatus(lastEntryWeek) {
  if (!lastEntryWeek) return 'dead';
  const now        = Date.now();
  const thisWeek   = toISOWeek(now);
  const lastWeek   = toISOWeek(now - 7 * 86_400_000);
  const twoWeeksAgo = toISOWeek(now - 14 * 86_400_000);
  if (lastEntryWeek === thisWeek)    return 'active';
  if (lastEntryWeek === lastWeek)    return 'jeopardy';
  if (lastEntryWeek === twoWeeksAgo) return 'recently_ended';
  return 'dead';
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
