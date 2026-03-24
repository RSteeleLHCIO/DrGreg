# TobbiHealth Auth Backend — Deployment Guide

This guide walks through deploying the four passkey Lambda functions and wiring them to API Gateway.

---

## Prerequisites

- AWS account with permissions to create Lambda, API Gateway, DynamoDB resources
- AWS CLI installed and configured (`aws configure`)
- Node.js 20 installed locally

---

## Step 1 — Install Dependencies

Run this once from the `backend/lambdas/` directory:

```bash
cd backend/lambdas
npm install
```

This creates a `node_modules/` folder containing `@simplewebauthn/server` and `jose`.  
The AWS SDK (`@aws-sdk/*`) is already included in the Lambda Node.js 20 runtime, but is listed in `package.json` for local development.

---

## Step 2 — Generate a JWT Secret

Pick a strong random secret and save it — you'll need it for the Lambda environment variables:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Keep this value private. Store it in AWS Secrets Manager or at minimum in a secure password manager.

---

## Step 3 — Create the DynamoDB Table

If you haven't created the `TobbiHealth` table yet:

1. Open **AWS Console → DynamoDB → Create table**
2. Table name: `TobbiHealth`
3. Partition key: `PK` (String)
4. Sort key: `SK` (String)
5. Billing mode: **On-demand**
6. Click **Create table**

**Enable TTL** (required for automatic challenge cleanup):

1. Open the `TobbiHealth` table → **Additional settings** tab
2. Under **Time to live (TTL)**: click **Enable**
3. TTL attribute name: `ttl`
4. Save

---

## Step 4 — Package the Lambda Functions

Each Lambda gets its own zip, but they all share the same `node_modules`.

```bash
cd backend/lambdas

# Windows PowerShell
Compress-Archive -Path register-begin.mjs, node_modules, package.json -DestinationPath register-begin.zip
Compress-Archive -Path register-finish.mjs, node_modules, package.json -DestinationPath register-finish.zip
Compress-Archive -Path login-begin.mjs, node_modules, package.json -DestinationPath login-begin.zip
Compress-Archive -Path login-finish.mjs, node_modules, package.json -DestinationPath login-finish.zip
Compress-Archive -Path profile-get.mjs, node_modules, package.json -DestinationPath profile-get.zip
Compress-Archive -Path profile-save.mjs, node_modules, package.json -DestinationPath profile-save.zip
Compress-Archive -Path photo-upload-url.mjs, node_modules, package.json -DestinationPath photo-upload-url.zip
Compress-Archive -Force -Path metric-definition-save.mjs, node_modules, package.json -DestinationPath metric-definition-save.zip
Compress-Archive -Force -Path metric-catalog-get.mjs, node_modules, package.json -DestinationPath metric-catalog-get.zip
Compress-Archive -Force -Path metric-subscriptions-get.mjs, node_modules, package.json -DestinationPath metric-subscriptions-get.zip
Compress-Archive -Force -Path metric-subscribe.mjs, node_modules, package.json -DestinationPath metric-subscribe.zip
```

---

## Step 5 — Create the Lambda Functions

Repeat for each of the four functions. In **AWS Console → Lambda → Create function**:

| Setting | Value |
|---------|-------|
| Function name | `tobbihealth-register-begin` (repeat for each) |
| Runtime | **Node.js 20.x** |
| Architecture | x86_64 |
| Handler | `register-begin.handler` (match filename without .mjs) |

Upload the corresponding `.zip` from Step 4 via **Upload from → .zip file**.

---

## Step 6 — Set Environment Variables

For **each** Lambda function, go to **Configuration → Environment variables** and add:

| Key | Value | Notes |
|-----|-------|-------|
| `TABLE_NAME` | `TobbiHealth` | DynamoDB table name |
| `RP_ID` | `localhost` | Domain only — no protocol or port. Change to your domain in production. |
| `RP_NAME` | `TobbiHealth` | Display name shown in the passkey prompt |
| `EXPECTED_ORIGIN` | `http://localhost:5173` | Full origin URL. Change to `https://yourdomain.com` in production. |
| `CORS_ORIGIN` | `http://localhost:5173` | Same as above. Use `*` only for testing. |
| `JWT_SECRET` | *(your generated secret)* | Required for `register-finish` and `login-finish` only |

> `register-begin` and `login-begin` do **not** need `JWT_SECRET`.

---

## Step 7 — Set Lambda IAM Permissions

Each Lambda needs permission to read and write the DynamoDB table.

1. Go to **Lambda → function → Configuration → Permissions**
2. Click the **Execution role** link (opens IAM)
3. **Attach policies** → search for and add **AmazonDynamoDBFullAccess**  
   *(For production, scope this down to the specific table ARN using a custom policy)*

---

## Step 8 — Create the API Gateway (HTTP API)

1. **AWS Console → API Gateway → Create API → HTTP API**
2. API name: `TobbiHealth-Auth`
3. Add integrations: Lambda (select your region)

**Add four routes:**

| Method | Route | Lambda integration |
|--------|-------|--------------------|
| POST | `/auth/register/begin` | `tobbihealth-register-begin` |
| POST | `/auth/register/finish` | `tobbihealth-register-finish` |
| POST | `/auth/login/begin` | `tobbihealth-login-begin` |
| POST | `/auth/login/finish` | `tobbihealth-login-finish` |
| GET  | `/profile`          | `tobbihealth-profile-get` |
| PUT  | `/profile`          | `tobbihealth-profile-save` |
| PUT  | `/metric`           | `tobbihealth-metric-definition-save` |
| GET  | `/metrics/catalog`  | `tobbihealth-metric-catalog-get` |
| GET  | `/subscriptions`    | `tobbihealth-metric-subscriptions-get` |
| POST | `/subscription`     | `tobbihealth-metric-subscribe` |
| DELETE | `/subscription`   | `tobbihealth-metric-subscribe` |

4. Under **CORS**, set:
   - **Allow origin**: `http://localhost:5173`
   - **Allow headers**: `content-type` then `authorization` *(two separate chips — do NOT combine into one)*
   - **Allow methods**: `POST, PUT, GET, DELETE, OPTIONS`

   > ⚠️ **AWS UI gotchas**:
   > 1. After typing each value, you must click **Add** to lock it in as a tag/chip before clicking **Save**. Values still in the text box when you hit Save are silently discarded.
   > 2. Each header must be its **own chip**. Entering `content-type, authorization` as one chip creates a single header name with a comma in it — it will **not** match the `content-type` or `authorization` browser headers.

5. Deploy to a stage (e.g. `dev`)

Note the **Invoke URL** — it will look like:  
`https://abc123.execute-api.us-east-1.amazonaws.com`

---

## Step 9 — Add the API URL to the Frontend

Create a `.env.local` file in the root of the TobbiHealth project (this file is git-ignored):

```
VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
```

The frontend code will use `import.meta.env.VITE_API_URL` to reach the API.

---

## Step 10 — Smoke Test

With the dev server running (`npm run dev`), open your browser console and test:

```javascript
// Register begin
const r = await fetch('https://YOUR-API-URL/auth/register/begin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'ray' }),
});
console.log(await r.json());
// Expect: { options: { ... }, userId: "..." }
```

---

## Production Checklist

Before deploying to a real domain:

- [ ] Change `RP_ID` to your bare domain (e.g. `tobbihealth.yourdomain.com`)
- [ ] Change `EXPECTED_ORIGIN` to `https://tobbihealth.yourdomain.com`
- [ ] Change `CORS_ORIGIN` to same
- [ ] Move `JWT_SECRET` to **AWS Secrets Manager** and read it at runtime
- [ ] Scope IAM policy to the specific DynamoDB table ARN (not `FullAccess`)
- [ ] Enable **AWS WAF** on the API Gateway to rate-limit auth endpoints
- [ ] Enable **CloudTrail** logging for the Lambda functions

---

## Appendix — Profile Photo via S3

Profile photos are uploaded directly from the browser to S3 using a presigned PUT URL.  
The Lambda never receives the image bytes, keeping payloads small.

### A — Create the S3 bucket

1. **AWS Console → S3 → Create bucket**
2. Bucket name: `tobbihealth-photos` *(must be globally unique — adjust if taken)*
3. Region: same as your Lambdas (e.g. `us-east-2`)
4. **Uncheck "Block all public access"** → confirm the warning
   - Photos are served by their public URL; the path (`photos/<userId>/profile.jpg`) is non-guessable
5. Create the bucket

### B — Bucket policy (public-read for photos/)

6. Open the bucket → **Permissions** tab → **Bucket policy** → Edit, paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadPhotos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::tobbihealth-photos/photos/*"
    }
  ]
}
```

### C — Bucket CORS (allows browser PUTs)

7. Still in Permissions → **Cross-origin resource sharing (CORS)** → Edit, paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedOrigins": ["http://localhost:5173"],
    "ExposeHeaders": []
  }
]
```

> Add your production origin to `AllowedOrigins` when you go live.

### D — Create the `tobbihealth-photo-upload-url` Lambda

8. Lambda → **Create function** → name `tobbihealth-photo-upload-url`, runtime **Node.js 20.x**
9. Upload `photo-upload-url.zip`, handler: `photo-upload-url.handler`
10. **Environment variables**:

| Key | Value |
|-----|-------|
| `PHOTO_BUCKET` | `tobbihealth-photos` |
| `CORS_ORIGIN` | `http://localhost:5173` |
| `JWT_SECRET` | *(same secret as other lambdas)* |

11. **IAM permissions** → Execution role → Attach policy → **AmazonS3FullAccess**  
    *(Or a custom policy scoped to `s3:PutObject` on `arn:aws:s3:::tobbihealth-photos/photos/*`)*

### E — API Gateway route

12. In `TobbiHealth-Auth` API → Routes → **Create route**:  
    `GET /photo-upload-url` → integration → `tobbihealth-photo-upload-url`
13. CORS → **Allow Methods** → add `GET` (alongside existing `POST, OPTIONS, PUT`)
14. Deploy the stage

### How it works end-to-end

```
User picks photo → preview shown (blob URL)
           ↓
User clicks Save in profile dialog
           ↓
Frontend: GET /photo-upload-url  →  Lambda returns { uploadUrl, publicUrl }
           ↓
Frontend: PUT <uploadUrl> with image bytes  →  direct to S3 (no Lambda)
           ↓
Frontend: PUT /profile with { photo: publicUrl }  →  stored in DynamoDB
           ↓
On next load, profile-get returns publicUrl → <img src> renders the photo
```
