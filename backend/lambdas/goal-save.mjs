/**
 * goal-save — Create or update a user Goal.
 *
 * PUT /goal
 * Headers: Authorization: Bearer <jwt>
 * Body (create): { metricId, name, goalType, period, direction, aggregation,
 *                  startDate, [periodDays], [targetValue], [targetMin], [targetMax],
 *                  [streakTarget], [isActive], [endDate] }
 *                Omit goalId → a new goalId is generated.
 * Body (update): Same fields plus { goalId }
 *                Supply goalId → existing goal is overwritten, createdAt preserved.
 * Returns: { ok: true, goalId }
 *
 * GoalType-specific required fields:
 *   target_value / cumulative / best_of → targetValue (finite number)
 *   range                               → targetMin, targetMax (numbers, min < max)
 *   streak                              → streakTarget (positive integer)
 *   period = "rolling"                  → periodDays (positive integer)
 *
 * DynamoDB item shape:
 *   PK:       "USER#<userId>"
 *   SK:       "GOAL#<goalId>"
 *   itemType: "Goal"
 */

import { DynamoDBClient }                        from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand,
         GetCommand }                             from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                              from "jose";
import { randomUUID }                             from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const VALID_GOAL_TYPES   = new Set(["target_value", "cumulative", "range", "streak", "best_of"]);
const VALID_PERIODS      = new Set(["daily", "weekly", "monthly", "rolling", "all_time"]);
const VALID_DIRECTIONS   = new Set(["lower_is_better", "higher_is_better", "exact"]);
const VALID_AGGREGATIONS = new Set(["sum", "count", "avg", "max", "min"]);

const GOAL_ID_RE   = /^g-[a-z0-9-]+$/;
const METRIC_ID_RE = /^[a-z0-9-]+$/;
const DATE_RE      = /^\d{4}-\d{2}-\d{2}$/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
  };

  // Support API Gateway payload format v1 (httpMethod) and v2 (requestContext.http.method)
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
    const {
      goalId:      incomingGoalId,
      metricId,    name,          goalType,     period,
      periodDays,  targetValue,   targetMin,    targetMax,
      direction,   aggregation,   streakTarget,
      isActive,    startDate,     endDate,      startingValue,
    } = body;

    // ── Required field validation ──────────────────────────────────────────
    if (!metricId || !METRIC_ID_RE.test(metricId)) {
      return reply(400, { error: "metricId must be lowercase letters, digits, and hyphens only." }, corsHeaders);
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return reply(400, { error: "name is required." }, corsHeaders);
    }
    if (!VALID_GOAL_TYPES.has(goalType)) {
      return reply(400, { error: `goalType must be one of: ${[...VALID_GOAL_TYPES].join(", ")}.` }, corsHeaders);
    }
    if (!VALID_PERIODS.has(period)) {
      return reply(400, { error: `period must be one of: ${[...VALID_PERIODS].join(", ")}.` }, corsHeaders);
    }
    if (!VALID_DIRECTIONS.has(direction)) {
      return reply(400, { error: `direction must be one of: ${[...VALID_DIRECTIONS].join(", ")}.` }, corsHeaders);
    }
    if (!VALID_AGGREGATIONS.has(aggregation)) {
      return reply(400, { error: `aggregation must be one of: ${[...VALID_AGGREGATIONS].join(", ")}.` }, corsHeaders);
    }

    // ── GoalType-specific validation ───────────────────────────────────────
    if (["target_value", "cumulative", "best_of"].includes(goalType)) {
      if (typeof targetValue !== "number" || !Number.isFinite(targetValue)) {
        return reply(400, { error: "targetValue must be a finite number for this goalType." }, corsHeaders);
      }
    }
    if (goalType === "range") {
      if (typeof targetMin !== "number" || !Number.isFinite(targetMin) ||
          typeof targetMax !== "number" || !Number.isFinite(targetMax)) {
        return reply(400, { error: "targetMin and targetMax must be finite numbers for range goals." }, corsHeaders);
      }
      if (targetMin >= targetMax) {
        return reply(400, { error: "targetMin must be less than targetMax." }, corsHeaders);
      }
    }
    if (goalType === "streak") {
      if (typeof streakTarget !== "number" || !Number.isInteger(streakTarget) || streakTarget < 1) {
        return reply(400, { error: "streakTarget must be a positive integer for streak goals." }, corsHeaders);
      }
    }
    if (period === "rolling") {
      if (typeof periodDays !== "number" || !Number.isInteger(periodDays) || periodDays < 1) {
        return reply(400, { error: "periodDays must be a positive integer when period is 'rolling'." }, corsHeaders);
      }
    }
    if (!startDate || !DATE_RE.test(startDate)) {
      return reply(400, { error: "startDate must be in YYYY-MM-DD format." }, corsHeaders);
    }
    if (endDate != null && !DATE_RE.test(endDate)) {
      return reply(400, { error: "endDate must be in YYYY-MM-DD format, or null." }, corsHeaders);
    }

    // ── Verify metric exists and caller has access ─────────────────────────
    const { Item: def } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `METRIC#${metricId}`, SK: "#DEF" },
    }));
    if (!def) return reply(404, { error: "Metric not found." }, corsHeaders);
    if (!def.isPublic && def.createdBy !== userId) {
      return reply(403, { error: "Access denied." }, corsHeaders);
    }

    // ── Resolve goalId, preserve createdAt on updates ─────────────────────
    const isCreate = !incomingGoalId;
    const goalId   = isCreate ? `g-${randomUUID()}` : incomingGoalId;

    if (!isCreate && !GOAL_ID_RE.test(goalId)) {
      return reply(400, { error: "goalId format is invalid." }, corsHeaders);
    }

    const now = new Date().toISOString();
    let createdAt = now;

    if (!isCreate) {
      const { Item: existing } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `GOAL#${goalId}` },
      }));
      if (!existing)               return reply(404, { error: "Goal not found." }, corsHeaders);
      if (existing.userId !== userId) return reply(403, { error: "Access denied." }, corsHeaders);
      createdAt = existing.createdAt;
    }

    // ── Build and write item ───────────────────────────────────────────────
    const item = {
      PK:          `USER#${userId}`,
      SK:          `GOAL#${goalId}`,
      itemType:    "Goal",
      goalId,
      metricId,
      userId,
      name:        name.trim().slice(0, 100),
      goalType,
      period,
      periodDays:  period === "rolling"                                      ? periodDays  : null,
      targetValue: ["target_value", "cumulative", "best_of"].includes(goalType) ? targetValue : null,
      startingValue: goalType === "target_value" && typeof startingValue === "number" && Number.isFinite(startingValue) ? startingValue : null,
      targetMin:   goalType === "range"  ? targetMin  : null,
      targetMax:   goalType === "range"  ? targetMax  : null,
      direction,
      aggregation,
      streakTarget: goalType === "streak" ? streakTarget : null,
      isActive:    isActive !== false,
      startDate,
      endDate:     endDate ?? null,
      createdAt,
      updatedAt:   now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    return reply(200, { ok: true, goal: item }, corsHeaders);

  } catch (err) {
    console.error("goal-save error:", err);
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
