/**
 * goal-progress-get — Compute current progress toward a Goal.
 *
 * GET /goal/progress?goalId=<id>[&now=<ts_ms>]
 * Headers: Authorization: Bearer <jwt>
 *
 * Query params:
 *   goalId  — required
 *   now     — optional ms-epoch override for "current time"; defaults to Date.now().
 *             Allows historical reporting and testing.
 *
 * Returns:
 * {
 *   goalId,      metricId,    goalType,   period,
 *   from,        to,                         ← period window (ms epoch)
 *   periodLabel,                             ← e.g. "Week of Mar 24, 2026"
 *   current,                                 ← aggregated value (number | null)
 *   target,                                  ← targetValue or streakTarget (null for range)
 *   targetMin,   targetMax,                  ← populated for range goals, null otherwise
 *   pct,                                     ← 0.0–1.0 progress fraction (null = no data)
 *   isOnTrack,                               ← boolean (null = no data)
 *   entryCount,                              ← entries found in period
 *   inRangeCount,                            ← range goals: entries within [targetMin, targetMax]
 * }
 *
 * ── GoalType evaluation strategies ──────────────────────────────────────────
 *
 *   target_value
 *     Latest entry value vs targetValue.
 *     pct:        higher_is_better → min(V / T, 1.0)
 *                 lower_is_better  → min(T / V, 1.0)
 *     isOnTrack:  goal condition already met (latest value has crossed target).
 *
 *   cumulative
 *     Sum or count of all entries in the period window vs targetValue.
 *     Aggregation field controls sum vs count.
 *     For boolean metrics + count: counts entries where value === true.
 *     isOnTrack:  pace check — current / targetValue ≥ elapsed fraction of period.
 *                 (e.g., 3 days into a 7-day week = 43% elapsed; on-track if ≥ 43% done)
 *
 *   range
 *     Percentage of entries in [targetMin, targetMax] across the period.
 *     pct:        inRangeCount / totalCount
 *     isOnTrack:  ≥ 80% of entries are in range (clinical "Time in Range" threshold).
 *     current:    average value in period (for display alongside the range band).
 *
 *   streak
 *     Uses currentDailyStreak from the user's MetricSubscription item.
 *     No date-range query needed — streak is maintained by metric-entry.mjs.
 *     pct:        min(currentDailyStreak / streakTarget, 1.0)
 *     isOnTrack:  currentDailyStreak ≥ streakTarget (milestone reached).
 *
 *   best_of
 *     Best entry value in the period window (all_time covers full history).
 *     direction drives "best": lower_is_better → min(), higher_is_better → max().
 *     pct:        same formula as target_value.
 *     isOnTrack:  best value has met or beaten targetValue.
 *
 * ── Notes ───────────────────────────────────────────────────────────────────
 *   Period boundaries are computed in UTC.  Future versions may accept a tz hint.
 *   Pagination is not yet implemented; assumes ≤ a few thousand entries per metric.
 */

import { DynamoDBClient }                        from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand,
         QueryCommand }                           from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                              from "jose";

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

    const qs     = event.queryStringParameters || {};
    const goalId = qs.goalId ?? null;

    if (!goalId || !/^g-[a-z0-9-]+$/.test(goalId)) {
      return reply(400, { error: "goalId query parameter is required and must be a valid goal identifier." }, corsHeaders);
    }

    // Optional time override (for testing / historical reports)
    const nowMs = (() => {
      const raw = parseInt(qs.now, 10);
      return Number.isFinite(raw) && raw > 0 ? raw : Date.now();
    })();

    // ── 1. Fetch the Goal ─────────────────────────────────────────────────
    const { Item: goal } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `GOAL#${goalId}` },
    }));

    if (!goal)               return reply(404, { error: "Goal not found." }, corsHeaders);
    if (goal.userId !== userId) return reply(403, { error: "Access denied." }, corsHeaders);

    const { metricId, goalType, period, periodDays,
            targetValue, targetMin, targetMax,
            direction, aggregation, streakTarget } = goal;

    // ── 2. Streak goals don't need an entry query ─────────────────────────
    if (goalType === "streak") {
      const result = await computeStreakProgress(
        userId, metricId, streakTarget, goalId, nowMs
      );
      return reply(200, result, corsHeaders);
    }

    // ── 3. Compute period window ──────────────────────────────────────────
    const { from, to, periodLabel } = getPeriodWindow(period, periodDays, nowMs);

    // ── 4. Query metric entries in the period ─────────────────────────────
    const skFrom = `TS#${String(from).padStart(16, "0")}`;
    const skTo   = `TS#${String(to).padStart(16, "0")}`;

    const { Items: entries = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk":   `USER#${userId}#METRIC#${metricId}`,
        ":from": skFrom,
        ":to":   skTo,
      },
    }));

    // ── 5. Evaluate by goalType ───────────────────────────────────────────
    let progress;

    switch (goalType) {
      case "target_value":
        progress = evalTargetValue(entries, targetValue, direction,
                                   goalId, metricId, goalType, period, from, to, periodLabel);
        break;
      case "cumulative":
        progress = evalCumulative(entries, targetValue, aggregation, direction,
                                  goalId, metricId, goalType, period, from, to, periodLabel, nowMs);
        break;
      case "range":
        progress = evalRange(entries, targetMin, targetMax,
                             goalId, metricId, goalType, period, from, to, periodLabel);
        break;
      case "best_of":
        progress = evalBestOf(entries, targetValue, direction,
                              goalId, metricId, goalType, period, from, to, periodLabel);
        break;
      default:
        return reply(400, { error: `Unknown goalType: ${goalType}` }, corsHeaders);
    }

    return reply(200, progress, corsHeaders);

  } catch (err) {
    console.error("goal-progress-get error:", err);
    return reply(500, { error: "Internal server error" }, corsHeaders);
  }
};

// ── Period window helpers ─────────────────────────────────────────────────────

/**
 * Returns { from, to, periodLabel } for the current period window.
 * All boundaries are in UTC.
 */
function getPeriodWindow(period, periodDays, nowMs) {
  const now = new Date(nowMs);

  switch (period) {
    case "daily": {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCHours(23, 59, 59, 999);
      return {
        from: start.getTime(),
        to:   end.getTime(),
        periodLabel: `Today, ${formatDate(start)}`,
      };
    }

    case "weekly": {
      // ISO week: Monday–Sunday
      const dow          = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
      const daysFromMon  = dow === 0 ? 6 : dow - 1;
      const monday       = new Date(now);
      monday.setUTCDate(now.getUTCDate() - daysFromMon);
      monday.setUTCHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      sunday.setUTCHours(23, 59, 59, 999);
      return {
        from: monday.getTime(),
        to:   sunday.getTime(),
        periodLabel: `Week of ${formatDate(monday)}`,
      };
    }

    case "monthly": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return {
        from: start.getTime(),
        to:   end.getTime(),
        periodLabel: now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      };
    }

    case "rolling": {
      const days  = periodDays ?? 7;
      const start = nowMs - days * 86_400_000;
      return {
        from: start,
        to:   nowMs,
        periodLabel: `Last ${days} days`,
      };
    }

    case "all_time":
    default:
      return {
        from: 0,
        to:   nowMs,
        periodLabel: "All time",
      };
  }
}

/** Format a Date as "Mon DD, YYYY" in UTC */
function formatDate(d) {
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/** Reduce entries[] down to a single number according to aggregation. */
function aggregate(entries, aggregation) {
  if (entries.length === 0) return null;

  switch (aggregation) {
    case "sum":
      return entries.reduce((acc, e) => acc + toNum(e.value), 0);
    case "count":
      // Boolean metrics: count truthy values.  Numeric: count all entries.
      return entries.filter(e => e.value === true || (typeof e.value === "number" && e.value !== 0)).length;
    case "avg": {
      const nums = entries.map(e => toNum(e.value));
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
    case "max":
      return Math.max(...entries.map(e => toNum(e.value)));
    case "min":
      return Math.min(...entries.map(e => toNum(e.value)));
    default:
      return null;
  }
}

function toNum(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  return typeof v === "number" ? v : 0;
}

// ── pct helper ────────────────────────────────────────────────────────────────

/**
 * Compute a 0.0–1.0 progress fraction toward a scalar target.
 * Returns null when inputs are invalid.
 */
function scalarPct(value, target, direction) {
  if (value == null || target == null || target === 0) return null;
  if (direction === "higher_is_better") return Math.min(value / target, 1.0);
  if (direction === "lower_is_better")  return Math.min(target / Math.max(value, Number.EPSILON), 1.0);
  if (direction === "exact")            return value === target ? 1.0 : 0.0;
  return null;
}

// ── Evaluation functions per goalType ─────────────────────────────────────────

function evalTargetValue(entries, targetValue, direction,
                         goalId, metricId, goalType, period, from, to, periodLabel) {
  // Use the most recent entry value in the period
  const latest  = entries.length > 0 ? entries[entries.length - 1] : null;
  const current = latest ? toNum(latest.value) : null;
  const pct     = scalarPct(current, targetValue, direction);

  let isOnTrack = null;
  if (current !== null) {
    isOnTrack = direction === "higher_is_better" ? current >= targetValue
              : direction === "lower_is_better"  ? current <= targetValue
              : current === targetValue;
  }

  return {
    goalId, metricId, goalType, period, from, to, periodLabel,
    current, target: targetValue, targetMin: null, targetMax: null,
    pct, isOnTrack, entryCount: entries.length, inRangeCount: null,
  };
}

function evalCumulative(entries, targetValue, aggregation, direction,
                        goalId, metricId, goalType, period, from, to, periodLabel, nowMs) {
  const current = aggregate(entries, aggregation);
  const pct     = targetValue ? Math.min((current ?? 0) / targetValue, 1.0) : null;

  // Pace check: are we accumulating fast enough to hit the target by end of period?
  let isOnTrack = null;
  if (current !== null && targetValue != null && to > from) {
    const elapsedFraction = Math.min(Math.max((nowMs - from) / (to - from), 0), 1);
    const required        = targetValue * elapsedFraction;
    isOnTrack = direction === "lower_is_better"
      ? (current ?? 0) <= required
      : (current ?? 0) >= required;
  }

  return {
    goalId, metricId, goalType, period, from, to, periodLabel,
    current, target: targetValue, targetMin: null, targetMax: null,
    pct, isOnTrack, entryCount: entries.length, inRangeCount: null,
  };
}

function evalRange(entries, targetMin, targetMax,
                   goalId, metricId, goalType, period, from, to, periodLabel) {
  const total      = entries.length;
  const inRange    = entries.filter(e => {
    const v = toNum(e.value);
    return v >= targetMin && v <= targetMax;
  }).length;

  const pct        = total > 0 ? inRange / total : null;
  const current    = total > 0 ? aggregate(entries, "avg") : null;
  // Clinical Time-in-Range standard: ≥ 80% considered "in range"
  const isOnTrack  = pct !== null ? pct >= 0.8 : null;

  return {
    goalId, metricId, goalType, period, from, to, periodLabel,
    current, target: null, targetMin, targetMax,
    pct, isOnTrack, entryCount: total, inRangeCount: inRange,
  };
}

function evalBestOf(entries, targetValue, direction,
                    goalId, metricId, goalType, period, from, to, periodLabel) {
  // "Best" is determined by direction: lower_is_better → min, otherwise → max
  const best = entries.length > 0
    ? direction === "lower_is_better"
      ? Math.min(...entries.map(e => toNum(e.value)))
      : Math.max(...entries.map(e => toNum(e.value)))
    : null;

  const pct        = scalarPct(best, targetValue, direction);
  let isOnTrack    = null;
  if (best !== null) {
    isOnTrack = direction === "higher_is_better" ? best >= targetValue
              : direction === "lower_is_better"  ? best <= targetValue
              : best === targetValue;
  }

  return {
    goalId, metricId, goalType, period, from, to, periodLabel,
    current: best, target: targetValue, targetMin: null, targetMax: null,
    pct, isOnTrack, entryCount: entries.length, inRangeCount: null,
  };
}

async function computeStreakProgress(userId, metricId, streakTarget, goalId, nowMs) {
  // Streak is maintained by metric-entry.mjs on every save — read from subscription
  const { Item: sub } = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `USER#${userId}`, SK: `METRIC#${metricId}` },
  }));

  const current   = sub?.currentDailyStreak ?? 0;
  const pct       = streakTarget > 0 ? Math.min(current / streakTarget, 1.0) : null;
  const isOnTrack = current >= streakTarget;
  const now       = new Date(nowMs);

  return {
    goalId,
    metricId,
    goalType:    "streak",
    period:      "all_time",
    from:        0,
    to:          nowMs,
    periodLabel: "All time",
    current,
    target:      streakTarget,
    targetMin:   null,
    targetMax:   null,
    pct,
    isOnTrack,
    entryCount:  null,   // not applicable
    inRangeCount: null,
    // Bonus: expose raw streak fields from subscription for richer UI
    maxDailyStreak:          sub?.maxDailyStreak ?? 0,
    currentDailyStreakStart: sub?.currentDailyStreakStart ?? null,
    lastEntryDate:           sub?.lastEntryDate ?? null,
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

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
