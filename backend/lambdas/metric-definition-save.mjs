/**
 * metric-definition-save — Creates or updates a custom metric definition.
 *
 * PUT /metric
 * Headers: Authorization: Bearer <jwt>
 * Body:    { metricId, friendlyName, icon, infoUrl, valueType,
 *            sliderEnabled, logicalMin, logicalMax, uom, falseTag, trueTag }
 * Returns: { ok: true, metricId }
 *
 * DynamoDB item shape:
 *   PK:        "METRIC#<metricId>"
 *   SK:        "#DEF"
 *   itemType:  "MetricDefinition"
 *   createdBy: <userId>   ← the authenticated user who defined it
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { jwtVerify } from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const VALID_VALUE_TYPES = new Set(["numeric", "boolean", "string"]);
const VALID_ICONS       = new Set([
  "Activity", "Heart", "Droplet", "Gauge", "Moon", "Brain",
  "Bone", "Thermometer", "Pill", "Target", "Clock", "User",
]);

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body = parseBody(event.body);
    const {
      metricId, friendlyName, valueType,
      icon, infoUrl,
      sliderEnabled, logicalMin, logicalMax, uom,
      falseTag, trueTag,
    } = body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!metricId || !/^[a-z0-9-]+$/.test(metricId)) {
      return reply(400, { error: "metricId must be lowercase letters, digits, and hyphens only." }, corsHeaders);
    }
    if (!friendlyName || typeof friendlyName !== "string" || !friendlyName.trim()) {
      return reply(400, { error: "friendlyName is required." }, corsHeaders);
    }
    if (!VALID_VALUE_TYPES.has(valueType)) {
      return reply(400, { error: "valueType must be 'numeric', 'boolean', or 'string'." }, corsHeaders);
    }

    // ── Sanitise infoUrl — only allow http/https or omit ─────────────────
    const safeInfoUrl =
      typeof infoUrl === "string" && /^https?:\/\//i.test(infoUrl.trim())
        ? infoUrl.trim()
        : "";

    const now  = new Date().toISOString();
    const item = {
      PK:           `METRIC#${metricId}`,
      SK:           "#DEF",
      itemType:     "MetricDefinition",
      metricId,
      friendlyName: friendlyName.trim().slice(0, 100),
      icon:         VALID_ICONS.has(icon) ? icon : "Activity",
      infoUrl:      safeInfoUrl,
      valueType,
      isPublic:     false,   // user-created metrics are personal/private by default
      createdBy:    userId,
      updatedAt:    now,
    };

    if (valueType === "numeric") {
      item.sliderEnabled = !!sliderEnabled;
      item.uom           = typeof uom === "string" ? uom.trim().slice(0, 20) : "";
      if (item.sliderEnabled) {
        item.logicalMin = typeof logicalMin === "number" ? logicalMin : 0;
        item.logicalMax = typeof logicalMax === "number" ? logicalMax : 10;
      }
    } else if (valueType === "boolean") {
      item.falseTag = typeof falseTag === "string" ? falseTag.trim().slice(0, 50) : "No";
      item.trueTag  = typeof trueTag  === "string" ? trueTag.trim().slice(0, 50)  : "Yes";
    }

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    return reply(200, { ok: true, metricId }, corsHeaders);

  } catch (err) {
    console.error("metric-definition-save error:", err);
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

function parseBody(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function reply(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  };
}
