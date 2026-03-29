/**
 * program-enroll — Enroll in or unenroll from a Program.
 *
 * POST   /program/enroll  — Enrol (or re-enrol if previously unenrolled)
 * DELETE /program/enroll  — Unenrol (marks isActive: false; goals are NOT deleted)
 *
 * Headers: Authorization: Bearer <jwt>
 *
 * POST body:
 * {
 *   programId:      string,     // required
 *   enrolledGoalIds: string[],  // goalIds already created by the frontend wizard
 *   isCustomized:   boolean,    // true if user changed any goal from the template
 *   startDate:      string,     // optional YYYY-MM-DD; defaults to today (UTC)
 * }
 *
 * POST returns: { ok: true, enrollmentId, enrollment: Enrollment }
 *
 * DELETE body: { programId }
 * DELETE returns: { ok: true, programId }
 *
 * Enrolment flow context:
 *   1. Frontend fetches the Program from GET /programs/catalog.
 *   2. Frontend builds draft Goals from the Program's items + METRIC_GOAL_TEMPLATES.
 *   3. For public programs the wizard allows edits (isCustomized = true if changed).
 *      For sponsored programs the wizard locks all fields (isCustomized always false).
 *   4. Frontend calls PUT /goal for each accepted goal → receives goalIds.
 *   5. Frontend calls POST /program/enroll with those goalIds.
 *      The backend does NOT create goals itself.
 *
 * DemographicGroup matching is NOT enforced here (deferred).  The programId is
 * accepted without demographic eligibility checks at this time.
 *
 * DynamoDB key:
 *   PK = "USER#<userId>",  SK = "ENROLLMENT#<programId>"
 * (one enrolment per user per program; re-enrolment overwrites the record)
 */

import { DynamoDBClient }                        from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand,
         PutCommand, UpdateCommand }              from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                              from "jose";
import { randomUUID }                             from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const PROGRAM_RE = /^prog-[a-z0-9-]+$/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (method !== "POST" && method !== "DELETE") {
    return reply(405, { error: "Method not allowed" }, corsHeaders);
  }

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body      = parseBody(event.body);
    const programId = body.programId ?? null;

    if (!programId || !PROGRAM_RE.test(programId)) {
      return reply(400, { error: "programId is required and must be a valid program identifier." }, corsHeaders);
    }

    // ── DELETE: Unenrol ───────────────────────────────────────────────────
    if (method === "DELETE") {
      await ddb.send(new UpdateCommand({
        TableName:        TABLE,
        Key:              { PK: `USER#${userId}`, SK: `ENROLLMENT#${programId}` },
        UpdateExpression: "SET isActive = :false, updatedAt = :now",
        ExpressionAttributeValues: {
          ":false": false,
          ":now":   new Date().toISOString(),
        },
      }));
      return reply(200, { ok: true, programId }, corsHeaders);
    }

    // ── POST: Enrol ───────────────────────────────────────────────────────

    // Validate request body
    const enrolledGoalIds = Array.isArray(body.enrolledGoalIds) ? body.enrolledGoalIds : [];
    const isCustomized    = body.isCustomized === true;
    const now             = new Date().toISOString();
    const todayDate       = now.slice(0, 10);
    const startDate       = /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : todayDate;

    // Fetch program to snapshot name/type/version (try catalog first, then personal)
    let program = null;
    const { Item: catalogProg } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: "PROGRAMS", SK: `PROG#${programId}` },
    }));
    if (catalogProg) {
      program = catalogProg;
    } else {
      const { Item: personalProg } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${userId}`, SK: `PROGRAM#${programId}` },
      }));
      if (personalProg) program = personalProg;
    }

    if (!program) return reply(404, { error: "Program not found." }, corsHeaders);

    // Check for an existing enrolment to preserve enrolledAt on re-enrolment
    const { Item: existingEnrollment } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `ENROLLMENT#${programId}` },
    }));

    const enrollmentId = existingEnrollment?.enrollmentId ?? `enr-${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const enrolledAt   = existingEnrollment?.enrolledAt ?? now;

    // Sponsored programs never allow customisation — override to false
    const finalIsCustomized = program.programType === "sponsored" ? false : isCustomized;

    const enrollment = {
      PK:             `USER#${userId}`,
      SK:             `ENROLLMENT#${programId}`,
      itemType:       "Enrollment",
      enrollmentId,
      programId,
      programName:    program.name,
      programType:    program.programType,
      programVersion: program.version ?? 1,
      enrolledAt,
      startDate,
      enrolledGoalIds,
      isCustomized:   finalIsCustomized,
      isActive:       true,
      updatedAt:      now,
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: enrollment }));

    const { PK, SK, itemType, ...enrollmentOut } = enrollment;
    return reply(201, { ok: true, enrollmentId, enrollment: enrollmentOut }, corsHeaders);

  } catch (err) {
    console.error("program-enroll error:", err);
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
