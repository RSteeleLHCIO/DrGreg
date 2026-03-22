/**
 * photo-upload — Accepts a base64-encoded image from the browser, validates it,
 * and stores it in S3.  This avoids all S3 CORS issues by routing through
 * API Gateway (which already has CORS configured).
 *
 * PUT /photo-upload
 * Headers: Authorization: Bearer <jwt>
 *          Content-Type: application/json
 * Body:    { image: "<base64 string>", contentType: "image/jpeg" }
 * Returns: { publicUrl: string }
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { jwtVerify } from "jose";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES     = 5 * 1024 * 1024; // 5 MB decoded

const CORS_ORIGIN         = process.env.CORS_ORIGIN         || "*";
const JWT_SECRET          = process.env.JWT_SECRET          || "";
const PHOTO_BUCKET        = process.env.PHOTO_BUCKET        || "";
const PHOTO_BUCKET_REGION = process.env.PHOTO_BUCKET_REGION || process.env.AWS_REGION || "us-east-1";

const s3 = new S3Client({ region: PHOTO_BUCKET_REGION });

export const handler = async (event) => {
  try {
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Unauthorized" });

    if (!PHOTO_BUCKET) return reply(500, { error: "PHOTO_BUCKET not configured" });

    const body = parseBody(event.body);
    const { image, contentType } = body;

    if (!image)        return reply(400, { error: "Missing image data" });
    if (!ALLOWED_TYPES.has(contentType)) {
      return reply(400, { error: "Unsupported image type" });
    }

    const buffer = Buffer.from(image, "base64");
    if (buffer.byteLength > MAX_BYTES) {
      return reply(400, { error: "Image too large (max 5 MB)" });
    }

    const ext = contentType === "image/png"  ? "png"
              : contentType === "image/webp" ? "webp"
              : contentType === "image/gif"  ? "gif"
              : "jpg";

    const key = `photos/${userId}/profile.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket:      PHOTO_BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: contentType,
    }));

    const publicUrl = `https://${PHOTO_BUCKET}.s3.${PHOTO_BUCKET_REGION}.amazonaws.com/${key}`;
    return reply(200, { publicUrl });

  } catch (err) {
    console.error("photo-upload error:", err);
    return reply(500, { error: "Internal server error" });
  }
};

async function authenticate(event) {
  try {
    const auth  = event.headers?.authorization || event.headers?.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return null;
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.sub;
  } catch {
    return null;
  }
}

function parseBody(raw) {
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

function reply(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type":                 "application/json",
      "Access-Control-Allow-Origin":  CORS_ORIGIN,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}
