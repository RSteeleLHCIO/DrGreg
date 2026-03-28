/**
 * metric-entry — Save or delete a single metric reading.
 *
 * PUT    /entry  { metric, ts, value, source }
 *   → PutItem MetricEntry
 *   → UpdateItem MetricSubscription (streak fields)
 *   → Returns { ok: true, ts, currentDailyStreak, currentWeeklyStreak }
 *
 * DELETE /entry  { metric, ts }
 *   → DeleteItem MetricEntry
 *   → Streak is NOT recalculated on delete (would require full history scan)
 *   → Returns { ok: true }
 *
 * Headers: Authorization: Bearer <jwt>
 *
 * Streak update logic (server-side, in PUT handler):
 *   1. Compute today's date (YYYY-MM-DD) and ISO week (YYYY-Www) in UTC.
 *   2. Fetch current subscription item to read lastEntryDate / lastEntryWeek.
 *   3. If lastEntryDate === today → same day, no streak change (edit/duplicate).
 *   4. If lastEntryDate === yesterday → currentDailyStreak += 1, continue.
 *   5. Otherwise → currentDailyStreak = 1, reset currentDailyStreakStart.
 *   6. maxDailyStreak = max(currentDailyStreak, maxDailyStreak).
 *   7. Same logic for weekly streak using lastEntryWeek / currentWeeklyStreak.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

// Validate metric names: lowercase letters, digits, hyphens only.
const VALID_METRIC = /^[a-z0-9-]+$/;

export const handler = async (event) => {
  console.log("[metric-entry] invoked method=%s path=%s body=%s",
    event.httpMethod, event.path, event.body);

  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  };

  // Support both API Gateway payload format v1 (httpMethod) and v2 (requestContext.http.method)
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;

  if (httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Support both API Gateway payload format v1 (httpMethod) and v2 (requestContext.http.method)
  const method = httpMethod;
  if (method !== "PUT" && method !== "DELETE") {
    console.warn("[metric-entry] 405 — unexpected method:", method);
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) {
      console.warn("[metric-entry] 401 — authentication failed");
      return reply(401, { error: "Unauthorized" }, corsHeaders);
    }
    console.log("[metric-entry] authenticated userId:", userId);

    const body = parseBody(event.body);
    console.log("[metric-entry] parsed body:", JSON.stringify(body));
    const { metric } = body;

    if (!metric || !VALID_METRIC.test(metric)) {
      console.warn("[metric-entry] 400 — invalid metric name:", metric);
      return reply(400, { error: "metric must be lowercase letters, digits, and hyphens only." }, corsHeaders);
    }

    // ── DELETE: remove a single entry — no streak recalculation ─────────────
    if (method === "DELETE") {
      const { ts } = body;
      if (typeof ts !== "number" || !Number.isFinite(ts)) {
        console.warn("[metric-entry] 400 DELETE — invalid ts:", ts, typeof ts);
        return reply(400, { error: "ts must be a finite number (ms epoch)." }, corsHeaders);
      }

      const skTs = `TS#${String(ts).padStart(16, "0")}`;
      const deleteKey = { PK: `USER#${userId}#METRIC#${metric}`, SK: skTs };
      console.log("[metric-entry] DELETE key:", JSON.stringify(deleteKey));
      await ddb.send(new DeleteCommand({ TableName: TABLE, Key: deleteKey }));
      console.log("[metric-entry] DELETE succeeded");
      return reply(200, { ok: true }, corsHeaders);
    }

    // ── PUT: save entry + update streak ─────────────────────────────────────
    const { ts, value, source = "manual entry" } = body;

    if (typeof ts !== "number" || !Number.isFinite(ts)) {
      console.warn("[metric-entry] 400 PUT — invalid ts:", ts, typeof ts);
      return reply(400, { error: "ts must be a finite number (ms epoch)." }, corsHeaders);
    }
    if (value === undefined || value === null) {
      console.warn("[metric-entry] 400 PUT — value is null/undefined");
      return reply(400, { error: "value is required." }, corsHeaders);
    }

    console.log("[metric-entry] PUT — metric:", metric, "ts:", ts,
      "value:", value, "(type:", typeof value + ")", "source:", source);

    const now       = new Date().toISOString();
    const skTs      = `TS#${String(ts).padStart(16, "0")}`;
    const putItem   = {
      PK:        `USER#${userId}#METRIC#${metric}`,
      SK:        skTs,
      itemType:  "MetricEntry",
      userId,
      metric,
      ts,
      value,
      source,
      updatedAt: now,
    };
    console.log("[metric-entry] PutItem:", JSON.stringify(putItem));

    // 1. Write the MetricEntry item.
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item:      putItem,
    }));
    console.log("[metric-entry] PutItem succeeded — SK:", skTs);

    // 2. Update streak fields on the MetricSubscription item.
    //    Fetch current sub to read lastEntryDate/lastEntryWeek and current streaks.
    const { Item: sub } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `METRIC#${metric}` },
    }));

    // Compute today's date and ISO week in UTC.
    const entryDate    = toISODate(ts);           // entry date, not today
    const entryWeek    = toISOWeek(ts);           // ISO week of the entry
    const todayDate    = toISODate(Date.now());
    const todayWeek    = toISOWeek(Date.now());

    // Use entry date for streak logic (allows back-filling past days correctly).
    const lastDate = sub?.lastEntryDate ?? null;
    const lastWeek = sub?.lastEntryWeek ?? null;

    let curDailyStreak      = sub?.currentDailyStreak      ?? 0;
    let maxDailyStreak      = sub?.maxDailyStreak          ?? 0;
    let dailyStreakStart     = sub?.currentDailyStreakStart ?? null;
    let curWeeklyStreak     = sub?.currentWeeklyStreak     ?? 0;
    let maxWeeklyStreak     = sub?.maxWeeklyStreak         ?? 0;

    // Advance streak when a newer day is recorded (forward logging).
    // Also handle the common back-fill case: logging yesterday when today
    // already exists — the two days are consecutive so the streak should grow.
    if (!lastDate || entryDate > lastDate) {
      // Daily streak — forward path
      if (lastDate && isConsecutiveDay(lastDate, entryDate)) {
        curDailyStreak += 1;
      } else if (lastDate && entryDate === lastDate) {
        // Same day — no change (should have been caught above, but guard)
      } else {
        // Gap — reset streak
        curDailyStreak  = 1;
        dailyStreakStart = entryDate;
      }
      if (curDailyStreak > maxDailyStreak) maxDailyStreak = curDailyStreak;
      if (!dailyStreakStart) dailyStreakStart = entryDate;

      // Weekly streak — forward path
      if (lastWeek && isConsecutiveWeek(lastWeek, entryWeek)) {
        curWeeklyStreak += 1;
      } else if (lastWeek && entryWeek === lastWeek) {
        // Same week — no change
      } else {
        curWeeklyStreak = 1;
      }
      if (curWeeklyStreak > maxWeeklyStreak) maxWeeklyStreak = curWeeklyStreak;

    } else if (lastDate && entryDate < lastDate) {
      // Back-fill path: entry is older than the most recent saved date.
      //
      // Policy: we reward consistency, not history manipulation.
      // Only extend the streak if the back-filled date is RECENT —
      //   daily:  entryDate must be yesterday or today (forgot to log yesterday)
      //   weekly: entryWeek must be last week or this week (forgot to log last week)
      // Anything older is treated as historical data entry and does not affect
      // the current streak counter.

      // Compute recency thresholds from todayDate (already in scope).
      const d = new Date(`${todayDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      const yesterdayDate = d.toISOString().slice(0, 10);
      const lastWeekStr   = toISOWeek(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Daily: recent AND immediately before lastDate
      if (entryDate >= yesterdayDate && isConsecutiveDay(entryDate, lastDate)) {
        curDailyStreak += 1;
        dailyStreakStart = entryDate; // streak now starts one day earlier
        if (curDailyStreak > maxDailyStreak) maxDailyStreak = curDailyStreak;
      }

      // Weekly: recent AND immediately before lastWeek
      if (entryWeek >= lastWeekStr && isConsecutiveWeek(entryWeek, lastWeek)) {
        curWeeklyStreak += 1;
        if (curWeeklyStreak > maxWeeklyStreak) maxWeeklyStreak = curWeeklyStreak;
      }

      // Note: lastEntryDate/lastEntryWeek are NOT updated for back-fills —
      // they always track the most recent entry date, which hasn't changed.
    }

    // Persist streak update (only if subscription record exists).
    console.log("[metric-entry] streak — sub found:", !!sub,
      "entryDate:", entryDate, "lastDate:", lastDate,
      "curDailyStreak:", curDailyStreak, "curWeeklyStreak:", curWeeklyStreak);

    if (sub) {
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `METRIC#${metric}` },
        UpdateExpression:
          "SET currentDailyStreak = :cds, maxDailyStreak = :mds, " +
          "currentDailyStreakStart = :dss, " +
          "currentWeeklyStreak = :cws, maxWeeklyStreak = :mws, " +
          "lastEntryDate = :led, lastEntryWeek = :lew, " +
          "updatedAt = :now",
        ExpressionAttributeValues: {
          ":cds": curDailyStreak,
          ":mds": maxDailyStreak,
          ":dss": dailyStreakStart,
          ":cws": curWeeklyStreak,
          ":mws": maxWeeklyStreak,
          ":led": entryDate > (lastDate ?? "") ? entryDate : lastDate,
          ":lew": entryWeek > (lastWeek ?? "") ? entryWeek : lastWeek,
          ":now": now,
        },
      }));
    }

    return reply(200, {
      ok: true,
      ts,
      currentDailyStreak:  curDailyStreak,
      currentWeeklyStreak: curWeeklyStreak,
    }, corsHeaders);

  } catch (err) {
    console.error("[metric-entry] unhandled error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a ms-epoch timestamp to 'YYYY-MM-DD' (UTC). */
function toISODate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Convert a ms-epoch timestamp to an ISO week string 'YYYY-Www'.
 * ISO weeks start on Monday. Week 1 contains the first Thursday of the year.
 */
function toISOWeek(ts) {
  const d = new Date(ts);
  // Find Thursday in this week's ISO week:
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Returns true if dateB is exactly one calendar day after dateA (YYYY-MM-DD strings). */
function isConsecutiveDay(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`);
  a.setUTCDate(a.getUTCDate() + 1);
  return a.toISOString().slice(0, 10) === dateB;
}

/**
 * Returns true if weekB is exactly one ISO week after weekA.
 * Accepts 'YYYY-Www' format strings.
 */
function isConsecutiveWeek(weekA, weekB) {
  const [yearA, wA] = weekA.split("-W").map(Number);
  const [yearB, wB] = weekB.split("-W").map(Number);
  if (yearA === yearB) return wB === wA + 1;
  // Handle year boundary: last week of yearA → week 1 of yearB
  const lastWeekOfYearA = weeksInYear(yearA);
  return wA === lastWeekOfYearA && yearB === yearA + 1 && wB === 1;
}

/** Returns the number of ISO weeks in a given year (52 or 53). */
function weeksInYear(year) {
  // A year has 53 ISO weeks if Jan 1 or Dec 31 is a Thursday
  const p = (y) => {
    const d = y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400);
    return d % 7;
  };
  return p(year) === 4 || p(year - 1) === 3 ? 53 : 52;
}

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
