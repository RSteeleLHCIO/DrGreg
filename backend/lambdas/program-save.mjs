/**
 * program-save — Create or update a Program.
 *
 * PUT /program
 * Headers: Authorization: Bearer <jwt>
 * Body (create): { programType, name, description, infoUrl, sponsorName,
 *                  category, tags, durationDays, demographicGroupId, items }
 *                Omit programId → a new programId is generated.
 * Body (update): Same fields plus { programId }
 *                Supply programId → existing program is overwritten, createdAt preserved.
 *                version is auto-incremented on every update.
 * Returns: { ok: true, programId }
 *
 * programType rules:
 *   personal   → stored under PK = "USER#<userId>",  SK = "PROGRAM#<programId>"
 *   public /
 *   sponsored  → stored under PK = "PROGRAMS",       SK = "PROG#<programId>"
 *
 * Constraints:
 *   - programType may NOT be changed after creation.
 *   - Only the original creator may update a program.
 *   - sponsored programs must supply sponsorName.
 *   - public / sponsored programs may only reference metrics with isPublic = true
 *     (metricId format is validated here; public-metric check is trusted to the frontend).
 *
 * DemographicGroup:
 *   demographicGroupId is a free-form slug ("any" = no restriction).  Matching
 *   against user profile data is deferred; the value is stored as-is.
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

const VALID_TYPES  = new Set(["public", "personal", "sponsored"]);
const PROGRAM_RE   = /^prog-[a-z0-9-]+$/;
const METRIC_RE    = /^[a-z0-9-]+$/;
const URL_RE       = /^https?:\/\/.+/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (method !== "PUT")     return reply(405, { error: "Method not allowed" }, corsHeaders);

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body = parseBody(event.body);

    // ── Validate required fields ──────────────────────────────────────────
    const { programType, name } = body;

    if (!programType || !VALID_TYPES.has(programType)) {
      return reply(400, { error: "programType must be 'public', 'personal', or 'sponsored'." }, corsHeaders);
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      return reply(400, { error: "name is required." }, corsHeaders);
    }
    if (programType === "sponsored" && !body.sponsorName?.trim()) {
      return reply(400, { error: "sponsorName is required for sponsored programs." }, corsHeaders);
    }
    if (body.infoUrl && !URL_RE.test(body.infoUrl)) {
      return reply(400, { error: "infoUrl must be a valid http/https URL." }, corsHeaders);
    }

    // ── Validate items ────────────────────────────────────────────────────
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      if (!item.metricId || !METRIC_RE.test(item.metricId)) {
        return reply(400, { error: `Invalid metricId in items: "${item.metricId}"` }, corsHeaders);
      }
    }

    // ── Determine PK/SK based on programType ─────────────────────────────
    const isCatalogProgram = programType !== "personal";
    const makePK = () => isCatalogProgram ? "PROGRAMS" : `USER#${userId}`;
    const makeSK = (id) => isCatalogProgram ? `PROG#${id}` : `PROGRAM#${id}`;

    const now = new Date().toISOString();

    // ── Create vs Update ──────────────────────────────────────────────────
    let programId   = body.programId ?? null;
    let createdAt   = now;
    let version     = 1;

    if (programId) {
      // Update path — validate ID and verify ownership
      if (!PROGRAM_RE.test(programId)) {
        return reply(400, { error: "Invalid programId format." }, corsHeaders);
      }
      const { Item: existing } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: makePK(), SK: makeSK(programId) },
      }));
      if (!existing) return reply(404, { error: "Program not found." }, corsHeaders);
      if (existing.createdBy !== userId) return reply(403, { error: "Access denied." }, corsHeaders);
      // programType may not change
      if (existing.programType !== programType) {
        return reply(400, { error: "programType cannot be changed after creation." }, corsHeaders);
      }
      createdAt = existing.createdAt ?? now;
      version   = (existing.version ?? 1) + 1;
    } else {
      // Create path — generate a new programId
      programId = `prog-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    }

    const isPublic = isCatalogProgram; // true for both 'public' and 'sponsored'

    const item = {
      PK:                 makePK(),
      SK:                 makeSK(programId),
      itemType:           "Program",
      programId,
      programType,
      name:               name.trim(),
      description:        body.description?.trim() ?? "",
      infoUrl:            body.infoUrl?.trim() ?? "",
      sponsorName:        programType === "sponsored" ? (body.sponsorName?.trim() ?? null) : null,
      createdBy:          userId,
      isPublic,
      version,
      category:           body.category?.trim() ?? "",
      tags:               Array.isArray(body.tags) ? body.tags.map(t => String(t).trim()).filter(Boolean) : [],
      durationDays:       Number.isFinite(body.durationDays) && body.durationDays > 0 ? body.durationDays : null,
      demographicGroupId: body.demographicGroupId?.trim() || "any",
      items:              items.map((it, idx) => ({
        itemId:         it.itemId?.trim() || `item-${idx + 1}`,
        metricId:       it.metricId.trim(),
        goalTemplateId: it.goalTemplateId ?? null,
        notes:          it.notes?.trim() ?? "",
      })),
      createdAt,
      updatedAt: now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

    return reply(201, { ok: true, programId }, corsHeaders);

  } catch (err) {
    console.error("program-save error:", err);
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
