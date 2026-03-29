/**
 * programs-catalog-get — Return all Programs visible to the authenticated user.
 *
 * GET /programs/catalog[?category=<str>]
 * Headers: Authorization: Bearer <jwt>
 *
 * Returns:
 * {
 *   programs: Program[]   // public + sponsored (catalog) + caller's personal programs
 * }
 *
 * DynamoDB access patterns:
 *   Catalog (public + sponsored): PK = "PROGRAMS",       SK begins_with "PROG#"
 *   Personal:                     PK = "USER#<userId>",  SK begins_with "PROGRAM#"
 *
 * Both sets are merged and returned together.  The frontend can distinguish them
 * via programType.  An optional `category` query param filters both sets.
 */

import { DynamoDBClient }                   from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient,
         QueryCommand }                      from "@aws-sdk/lib-dynamodb";
import { jwtVerify }                         from "jose";

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

  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (method !== "GET")     return reply(405, { error: "Method not allowed" }, corsHeaders);

  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" }, corsHeaders);

    const qs               = event.queryStringParameters || {};
    const categoryFilter   = qs.category ?? null;

    // ── 1. Catalog programs (public + sponsored) ─────────────────────────
    const { Items: catalogItems = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     "PROGRAMS",
        ":prefix": "PROG#",
      },
    }));

    // ── 2. Personal programs ──────────────────────────────────────────────
    const { Items: personalItems = [] } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk":     `USER#${userId}`,
        ":prefix": "PROGRAM#",
      },
    }));

    // ── 3. Merge, strip keys, optionally filter ───────────────────────────
    const strip = ({ PK, SK, itemType, ...rest }) => rest;

    let programs = [
      ...catalogItems.map(strip),
      ...personalItems.map(strip),
    ];

    if (categoryFilter) {
      programs = programs.filter(p => p.category === categoryFilter);
    }

    return reply(200, { programs }, corsHeaders);

  } catch (err) {
    console.error("programs-catalog-get error:", err);
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

function reply(statusCode, body, headers) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}
