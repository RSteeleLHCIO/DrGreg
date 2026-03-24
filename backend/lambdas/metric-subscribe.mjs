/**
 * metric-subscribe — Manage a user's metric subscriptions.
 *
 * POST   /subscription  { metricId }              →  subscribe (new) or re-activate (existing inactive)
 * POST   /subscription  { metricId, isActive: false } →  deactivate (hide from dashboard, keep record)
 * DELETE /subscription  { metricId }              →  fully unsubscribe (delete record)
 *
 * Headers: Authorization: Bearer <jwt>
 * Returns: { ok: true, metricId, isActive }
 *
 * Subscription states:
 *   No record            → never subscribed
 *   isActive: true       → subscribed and visible on dashboard
 *   isActive: false      → subscribed but hidden from dashboard ("removed from dashboard")
 *
 * POST rules:
 *   - For a new subscription: metric definition must exist and caller must have access.
 *   - For an existing subscription: just toggles isActive — no definition re-check needed.
 *   - Uses UpdateExpression with if_not_exists(subscribedAt) so the original subscribe
 *     date is preserved across deactivate/re-activate cycles.
 *
 * DELETE rules:
 *   - Removes the record entirely, returning the metric to "never subscribed" state.
 *   - Idempotent — deleting a non-existent subscription succeeds silently.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (method !== "POST" && method !== "DELETE") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body = parseBody(event.body);
    const { metricId } = body;

    if (!metricId || !/^[a-z0-9-]+$/.test(metricId)) {
      return reply(400, { error: "metricId must be lowercase letters, digits, and hyphens only." }, corsHeaders);
    }

    const BUILTIN_IDS = new Set(['weight','pain','back','headache','tired','temperature','heart','systolic','diastolic','glucose','tylenol','losartan']);
    if (BUILTIN_IDS.has(metricId)) {
      return reply(400, { error: "Built-in metrics cannot be subscribed to." }, corsHeaders);
    }

    // ── DELETE: Full unsubscribe — removes the record entirely ───────────
    if (method === "DELETE") {
      await ddb.send(new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `METRIC#${metricId}` },
      }));
      return reply(200, { ok: true, metricId, isActive: null }, corsHeaders);
    }

    // ── POST: Subscribe (new), re-activate, or deactivate ────────────────
    const isActive = body.isActive === false ? false : true;
    const now      = new Date().toISOString();

    // Check whether this user already has a subscription record.
    const { Item: existingSub } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `METRIC#${metricId}` },
    }));

    if (!existingSub) {
      // New subscription — validate the metric definition and access.
      const { Item: def } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `METRIC#${metricId}`, SK: "#DEF" },
      }));
      if (!def) {
        return reply(404, { error: "Metric not found." }, corsHeaders);
      }
      if (!def.isPublic && def.createdBy !== userId) {
        return reply(403, { error: "Access denied." }, corsHeaders);
      }
    }
    // Existing subscription — no re-validation needed; caller already has access.

    // Upsert: set isActive and updatedAt; preserve original subscribedAt if record exists.
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `METRIC#${metricId}` },
      UpdateExpression:
        "SET itemType = :type, userId = :uid, metricId = :mid, " +
        "isActive = :active, updatedAt = :now, " +
        "subscribedAt = if_not_exists(subscribedAt, :now)",
      ExpressionAttributeValues: {
        ":type":   "MetricSubscription",
        ":uid":    userId,
        ":mid":    metricId,
        ":active": isActive,
        ":now":    now,
      },
    }));

    return reply(200, { ok: true, metricId, isActive }, corsHeaders);

  } catch (err) {
    console.error("metric-subscribe error:", err);
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
