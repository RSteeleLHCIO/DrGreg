/**
 * program-delete — Delete a personal Program.
 *
 * DELETE /program
 * Headers: Authorization: Bearer <jwt>
 * Body: { programId }
 * Returns: { ok: true, programId }
 *
 * Rules:
 *   - Only personal programs (PK = "USER#<userId>") may be deleted.
 *   - Only the creator may delete the program.
 *   - Public and sponsored programs are immutable via this endpoint (admin
 *     tooling required to remove catalog entries).
 *   - Idempotent: deleting a non-existent personal program succeeds silently.
 *
 * Note: Enrollment records referencing this program are NOT automatically
 * cleaned up here.  The enrolled user's goals (created at enrolment) are also
 * left intact — the user retains their own data.
 */

import { DynamoDBClient }                        from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand,
         DeleteCommand }                          from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                              from "jose";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE       = process.env.TABLE_NAME  || "TobbiHealth";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const JWT_SECRET  = process.env.JWT_SECRET  || "";

const PROGRAM_RE = /^prog-[a-z0-9-]+$/;

export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  };

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (method !== "DELETE")  return reply(405, { error: "Method not allowed" }, corsHeaders);

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const body      = parseBody(event.body);
    const programId = body.programId ?? null;

    if (!programId || !PROGRAM_RE.test(programId)) {
      return reply(400, { error: "programId is required and must be a valid program identifier." }, corsHeaders);
    }

    // Only personal programs live under USER# partition — check there first
    const { Item: existing } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `PROGRAM#${programId}` },
    }));

    if (!existing) {
      // Check if it's a catalog program (public/sponsored) and block deletion
      const { Item: catalogItem } = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: "PROGRAMS", SK: `PROG#${programId}` },
      }));
      if (catalogItem) {
        return reply(403, { error: "Public and sponsored programs cannot be deleted via this endpoint." }, corsHeaders);
      }
      // Neither exists — idempotent success
      return reply(200, { ok: true, programId }, corsHeaders);
    }

    if (existing.createdBy !== userId) {
      return reply(403, { error: "Access denied." }, corsHeaders);
    }

    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `PROGRAM#${programId}` },
    }));

    return reply(200, { ok: true, programId }, corsHeaders);

  } catch (err) {
    console.error("program-delete error:", err);
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
