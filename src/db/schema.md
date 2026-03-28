# TobbiHealth — Database Schema & DynamoDB Design

**Last updated:** March 2026  
**Current storage:** `localStorage` (frontend-only prototype)  
**Target storage:** AWS DynamoDB (single-table design)

---

## Table of Contents

1. [Data Model Overview](#1-data-model-overview)
2. [Entity Definitions](#2-entity-definitions)
   - [User](#21-user)
   - [MetricEntry](#22-metricentry)
   - [ActiveCards](#23-activecards)
   - [FeatureFlags](#24-featureflags)
   - [MetricDefinition](#25-metricdefinition)
   - [Goal](#26-goal)
3. [Metric Catalogue](#3-metric-catalogue)
4. [DynamoDB Single-Table Design](#4-dynamodb-single-table-design)
   - [Key Schema](#41-key-schema)
   - [Item Type Examples](#42-item-type-examples)
   - [Access Patterns](#43-access-patterns)
   - [GSI Definitions](#44-gsi-definitions)
5. [Migration Path (localStorage → DynamoDB)](#5-migration-path)
6. [Security Notes](#6-security-notes)
7. [Future Entities](#7-future-entities)

---

## 1. Data Model Overview

```
User
 ├── profile (name, DOB, photo, feature flags)
 ├── services[]          ← connected health service accounts
 ├── activeCards[]       ← ordered list of dashboard card names
 └── dataPoints
       ├── weight        ← MetricEntry[]
       ├── heart         ← MetricEntry[]
       ├── glucose       ← MetricEntry[]
       ├── systolic      ← MetricEntry[]
       ├── diastolic     ← MetricEntry[]
       ├── temperature   ← MetricEntry[]
       ├── tired         ← MetricEntry[]
       ├── headache      ← MetricEntry[]
       ├── back          ← MetricEntry[]
       ├── tylenol       ← MetricEntry[]
       ├── losartan      ← MetricEntry[]
       └── pain          ← MetricEntry[]
```

---

## 2. Entity Definitions

### 2.1 User

Stores identity, preferences, and connected service credentials.

| Field        | Type            | Required | Notes                                                    |
|-------------|-----------------|----------|----------------------------------------------------------|
| `userId`     | string (UUID)   | ✅        | Primary identifier. Generated on first sign-up.         |
| `firstName`  | string          | ✅        |                                                          |
| `lastName`   | string          | ✅        |                                                          |
| `dob`        | string (ISO date) | ✅      | Format: `YYYY-MM-DD`                                     |
| `photo`      | string \| null  | ❌        | In prototype: base64 data-URL. In production: S3 object key. |
| `services`   | ServiceLink[]   | ✅        | Default: `[]`                                            |
| `paidVersion`| boolean         | ✅        | Feature flag. Default: `false`                           |
| `createdAt`  | string (ISO-8601) | ✅      | Set on account creation, never updated.                  |
| `updatedAt`  | string (ISO-8601) | ✅      | Updated on any profile save.                             |

#### ServiceLink (nested in `services[]`)

| Field       | Type            | Notes                                                         |
|------------|-----------------|---------------------------------------------------------------|
| `provider`  | string (enum)   | `"Fitbit"` \| `"Apple Health"` \| `"Google Fit"` \| `"Withings"` \| `"Oura"` \| `"Dexcom"` |
| `username`  | string          | Account identifier for the service                            |
| `linkedAt`  | string (ISO-8601) | When the service was connected                              |

> ⚠️ **Do not store passwords.** The current prototype stores a `password` field; this must be replaced with OAuth 2.0 access/refresh tokens before any backend is built. See [§6 Security](#6-security-notes).

---

### 2.2 MetricEntry

A single health measurement. One row per reading in DynamoDB.

| Field       | Type                  | Required | Notes                                                   |
|------------|-----------------------|----------|---------------------------------------------------------|
| `userId`    | string (UUID)         | ✅        | Foreign key to User                                     |
| `metric`    | string (enum)         | ✅        | See [Metric Catalogue](#3-metric-catalogue)             |
| `ts`        | number (ms epoch)     | ✅        | Unix timestamp in **milliseconds**. Used as sort key.   |
| `value`     | number \| boolean     | ✅        | `number` for singleValue/slider; `boolean` for switch   |
| `updatedAt` | string (ISO-8601)     | ✅        | Wall-clock time of last write                           |
| `source`    | string (enum)         | ✅        | `"manual entry"` \| `"Fitbit"` \| `"Apple Health"` \| `"Google Fit"` \| `"Withings"` \| `"Oura"` \| `"Dexcom"` \| `"Omron Connect"` |

---

### 2.3 ActiveCards

The user's preferred dashboard card order.  
In DynamoDB this is stored as a List attribute on the User item (not a separate table).

| Field         | Type       | Notes                                                     |
|--------------|------------|-----------------------------------------------------------|
| `activeCards` | string[]   | Ordered array of `cardName` values from the card catalogue |

Valid `cardName` values: `weight`, `symptoms`, `heart`, `temperature`, `blood-pressure`, `glucose`, `tired`, `headache`, `back`, `tylenol`, `losartan`

---

### 2.4 FeatureFlags

Simple boolean flags controlling feature availability per user.  
Stored as attributes on the User item in DynamoDB.

| Flag           | Type    | Default | Description                  |
|---------------|---------|---------|------------------------------|
| `paidVersion`  | boolean | `false` | Enables premium feature set  |

---

### 2.5 MetricDefinition

Describes a trackable metric. System metrics have `createdBy = "SYSTEM"` and `isPublic = true`; user-created metrics have `createdBy = <userId>` and `isPublic = false`.

| Field                | Type                                         | Required | Notes |
|---------------------|----------------------------------------------|----------|-------|
| `metricId`           | string (slug)                                | ✅        | e.g. `"blood-glucose"` |
| `friendlyName`       | string                                       | ✅        | Display label |
| `icon`               | string (Lucide icon name)                    | ✅        | From the allowed icon set |
| `infoUrl`            | string                                       | ❌        | Optional reference URL |
| `valueType`          | `"numeric"` \| `"boolean"` \| `"string"`     | ✅        | |
| `isPublic`           | boolean                                      | ✅        | |
| `createdBy`          | string                                       | ✅        | `"SYSTEM"` or userId |
| `updatedAt`          | string (ISO-8601)                            | ✅        | |
| `trackingFlavor`     | `"standalone"` \| `"cumulative"` \| `null`    | ❌        | UI hint for goal creation. `standalone` = each entry is individually significant (weight, HR); `cumulative` = entries aggregate toward a total (steps, meals cooked). `null` = no strong convention. |
| `defaultAggregation` | `"sum"` \| `"count"` \| `"avg"` \| `"max"` \| `"min"` \| `null` | ❌ | UI hint: pre-selects the aggregation method in the Goal creation dialog. Does not restrict user choice. |
| `goalTemplates`      | `GoalTemplate[]`                             | ❌        | Ordered list of suggested goal templates shown in the Goal creation wizard. Empty array = no templates. System metrics ship with pre-built templates seeded here. |
| `sliderEnabled`      | boolean                                      | ❌        | numeric metrics only |
| `uom`                | string                                       | ❌        | numeric metrics only |
| `logicalMin`         | number                                       | ❌        | numeric metrics only |
| `logicalMax`         | number                                       | ❌        | numeric metrics only |
| `falseTag`           | string                                       | ❌        | boolean metrics only |
| `trueTag`            | string                                       | ❌        | boolean metrics only |

#### GoalTemplate (nested in `goalTemplates[]`)

A pre-built goal suggestion offered in the Goal creation wizard so users can start from a sensible default. Selecting a template pre-fills the wizard; the user still adjusts target numbers before saving.

| Field               | Type              | Notes |
|--------------------|-------------------|-------|
| `templateId`        | string (slug)     | Unique within the metric's template list, e.g. `"weekly-total"` |
| `name`              | string            | UI label shown in the template picker card |
| `goalType`          | GoalType enum     | Pre-selects goalType step |
| `period`            | GoalPeriod enum   | Pre-selects period step |
| `direction`         | GoalDirection enum | Pre-selects direction |
| `aggregation`       | AggregationKind enum | Pre-selects aggregation |
| `suggestedTarget`   | number \| null    | Pre-populates targetValue input; null = leave blank for user to fill |
| `suggestedMin`      | number \| null    | range goals: pre-populates targetMin |
| `suggestedMax`      | number \| null    | range goals: pre-populates targetMax |
| `suggestedStreak`   | number \| null    | streak goals: pre-populates streakTarget |

> Templates are stored in the `goalTemplates` attribute of the MetricDefinition DynamoDB item.  
> System metric templates are seeded via a one-time script; they can be updated by re-seeding.  
> User-created metrics default to `goalTemplates: []` (no templates).

---

### 2.6 Goal

A user-defined target attached to a metric. Goals are evaluated by querying metric entries for the goal's period and aggregating them according to `goalType` and `aggregation`.

**Tracking flavors and how they map to `goalType`:**

| `goalType`     | Meaningful fields                        | Example |
|---------------|------------------------------------------|---------|
| `target_value` | `targetValue`, `direction`              | "Weigh 160 lbs" |
| `cumulative`   | `targetValue`, `aggregation`, `period`  | "Walk 50,000 steps this week"; "Cook at home 5 times this week" (boolean metric, `aggregation:"count"`) |
| `range`        | `targetMin`, `targetMax`, `period`      | "Keep glucose 70–140 mg/dL" |
| `streak`       | `streakTarget`                          | "Meditate 30 consecutive days" |
| `best_of`      | `targetValue`, `direction`              | "Run a mile under 8 min"; "Resting HR ≤ 55 bpm" |

| Field           | Type                                                                    | Required | Notes |
|----------------|-------------------------------------------------------------------------|----------|-------|
| `goalId`        | string (UUID)                                                           | ✅        | e.g. `"g-4a7b2c1d"` |
| `metricId`      | string                                                                  | ✅        | FK → MetricDefinition |
| `userId`        | string                                                                  | ✅        | FK → User |
| `name`          | string                                                                  | ✅        | Friendly label: "50,000 steps this week" |
| `goalType`      | `"target_value"` \| `"cumulative"` \| `"range"` \| `"streak"` \| `"best_of"` | ✅ | |
| `period`        | `"daily"` \| `"weekly"` \| `"monthly"` \| `"rolling"` \| `"all_time"`  | ✅        | Evaluation window |
| `periodDays`    | number \| null                                                          | ❌        | Only when `period = "rolling"` |
| `targetValue`   | number \| null                                                          | ❌        | Used by `target_value`, `cumulative`, `best_of` |
| `targetMin`     | number \| null                                                          | ❌        | Used by `range` |
| `targetMax`     | number \| null                                                          | ❌        | Used by `range` |
| `direction`     | `"lower_is_better"` \| `"higher_is_better"` \| `"exact"`               | ✅        | |
| `aggregation`   | `"sum"` \| `"count"` \| `"avg"` \| `"max"` \| `"min"`                  | ✅        | How entries are combined |
| `streakTarget`  | number \| null                                                          | ❌        | Used by `streak` |
| `isActive`      | boolean                                                                 | ✅        | Default: `true` |
| `startDate`     | string (ISO date)                                                       | ✅        | `"YYYY-MM-DD"` |
| `endDate`       | string (ISO date) \| null                                               | ❌        | null = ongoing |
| `createdAt`     | string (ISO-8601)                                                       | ✅        | |
| `updatedAt`     | string (ISO-8601)                                                       | ✅        | |

---

## 3. Metric Catalogue

| `metricName`  | Display Title    | Kind          | Unit    | Description                          |
|--------------|-----------------|---------------|---------|--------------------------------------|
| `weight`      | Weight           | singleValue   | lbs     | Body weight                          |
| `heart`       | Heart Rate       | singleValue   | bpm     | Resting or spot heart rate           |
| `glucose`     | Blood Glucose    | singleValue   | mg/dL   | Blood sugar level                    |
| `systolic`    | BP – Systolic    | singleValue   | mmHg    | Blood pressure upper value           |
| `diastolic`   | BP – Diastolic   | singleValue   | mmHg    | Blood pressure lower value           |
| `temperature` | Temperature      | singleValue   | °F      | Body temperature                     |
| `pain`        | Pain             | slider (0–10) | —       | General pain level                   |
| `tired`       | Tiredness        | slider (0–10) | —       | Self-reported fatigue level          |
| `headache`    | Headache         | slider (0–10) | —       | Headache severity                    |
| `back`        | Back Pain        | slider (0–10) | —       | Back pain severity                   |
| `tylenol`     | Rx – Tylenol     | switch        | —       | Was Tylenol taken in last 4 hours?   |
| `losartan`    | Rx – Losartan    | switch        | —       | Was Losartan taken today?            |

**Kind definitions:**
- `singleValue` — free numeric entry (text input)
- `slider` — integer 0–10 scale
- `switch` — boolean yes/no (medication taken)

---

## 4. DynamoDB Single-Table Design

### 4.1 Key Schema

**Table name:** `TobbiHealth`  
**Billing mode:** On-demand (PAY_PER_REQUEST) — appropriate for a personal health app with unpredictable but low traffic.

| Attribute | Role             | Type   |
|-----------|-----------------|--------|
| `PK`      | Partition key    | String |
| `SK`      | Sort key         | String |

#### Key patterns by item type

| Item type             | PK                                        | SK                              |
|----------------------|-------------------------------------------|---------------------------------|
| User profile          | `USER#<userId>`                           | `#PROFILE`                      |
| Metric entry          | `USER#<userId>#METRIC#<metricName>`       | `TS#<ts_ms_zero_padded>`        |
| Metric definition     | `METRIC#<metricId>`                       | `#DEF`                          |
| Metric subscription   | `USER#<userId>`                           | `METRIC#<metricId>`             |
| Goal                  | `USER#<userId>`                           | `GOAL#<goalId>`                 |

**Example keys:**

```
User profile:
  PK = "USER#u-7f3a1b2c"
  SK = "#PROFILE"

Weight reading at 2025-11-01 07:31 UTC:
  PK = "USER#u-7f3a1b2c#METRIC#weight"
  SK = "TS#0001730449800000"
```

> Timestamps are zero-padded to 16 digits so lexicographic sort equals chronological sort.

---

### 4.2 Item Type Examples

#### User Profile Item

```json
{
  "PK":          "USER#u-7f3a1b2c",
  "SK":          "#PROFILE",
  "itemType":    "UserProfile",
  "userId":      "u-7f3a1b2c",
  "firstName":   "Ray",
  "lastName":    "Steele",
  "dob":         "1959-10-21",
  "photoKey":    "photos/u-7f3a1b2c/profile.jpg",
  "services":    [
    { "provider": "Fitbit", "username": "ray@example.com", "linkedAt": "2025-11-01T00:00:00.000Z" }
  ],
  "activeCards": ["weight", "heart", "glucose", "blood-pressure", "tired"],
  "paidVersion": false,
  "createdAt":   "2025-11-01T00:00:00.000Z",
  "updatedAt":   "2026-01-15T14:22:00.000Z"
}
```

#### Credential Item

```json
{
  "PK":                  "USER#u-7f3a1b2c",
  "SK":                  "CRED#AaB3Cd4E...",
  "itemType":            "Credential",
  "userId":              "u-7f3a1b2c",
  "username":            "ray",
  "credentialId":        "AaB3Cd4E..." ,
  "credentialPublicKey": "pQECAyYg...",
  "counter":             42,
  "transports":          ["internal"],
  "createdAt":           "2026-03-22T10:00:00.000Z"
}
```

> `credentialId` and `credentialPublicKey` are base64url-encoded strings.  
> `counter` is incremented on every successful login (replay-attack protection).  
> `transports` hints which transport the authenticator supports (`"internal"` = platform biometric, `"usb"` = security key, etc.).

#### UsernameIndex Item

```json
{
  "PK":       "USERNAME#ray",
  "SK":       "#USER",
  "itemType": "UsernameIndex",
  "userId":   "u-7f3a1b2c",
  "username": "ray",
  "createdAt": "2026-03-22T10:00:00.000Z"
}
```

> A lookup record so `login-begin` can resolve a username → `userId` in a single `GetItem`.

#### PendingRegistration Item (temporary, TTL 5 min)

```json
{
  "PK":       "PENDING_REG#u-7f3a1b2c",
  "SK":       "#CHALLENGE",
  "itemType": "PendingRegistration",
  "challenge": "randomBase64urlChallenge",
  "userId":    "u-7f3a1b2c",
  "username":  "ray",
  "ttl":       1742641200
}
```

#### PendingAuth Item (temporary, TTL 5 min)

```json
{
  "PK":        "PENDING_AUTH#ray",
  "SK":        "#CHALLENGE",
  "itemType":  "PendingAuth",
  "challenge": "randomBase64urlChallenge",
  "userId":    "u-7f3a1b2c",
  "username":  "ray",
  "ttl":        1742641200
}
```

---

#### MetricEntry Item

```json
{
  "PK":        "USER#u-7f3a1b2c#METRIC#weight",
  "SK":        "TS#0001730449800000",
  "itemType":  "MetricEntry",
  "userId":    "u-7f3a1b2c",
  "metric":    "weight",
  "ts":        1730449800000,
  "value":     173,
  "updatedAt": "2025-11-01T07:31:00.000Z",
  "source":    "Fitbit"
}
```

#### MetricDefinition Item

```json
{
  "PK":          "METRIC#weight",
  "SK":          "#DEF",
  "itemType":    "MetricDefinition",
  "metricId":    "weight",
  "friendlyName": "Weight",
  "icon":        "Activity",
  "infoUrl":     "",
  "valueType":   "numeric",
  "sliderEnabled": false,
  "uom":         "lbs",
  "isPublic":    true,
  "createdBy":   "SYSTEM",
  "updatedAt":   "2026-03-23T00:00:00.000Z"
}
```

> `isPublic: true` for seed/system metrics; `false` for user-created (personal) metrics.  
> `createdBy: "SYSTEM"` for seed metrics; `userId` for user-created ones.  
> `trackingFlavor` and `defaultAggregation` are UI hints only — they pre-populate the Goal creation dialog but do not constrain what the user can configure.  
> `goalTemplates` is a DynamoDB List attribute containing GoalTemplate maps; see §2.5 for the GoalTemplate shape. System metrics ship with pre-built templates seeded here (e.g. weight → "Reach target weight", "Stay within weight range").

---

#### MetricSubscription Item

```json
{
  "PK":          "USER#u-7f3a1b2c",
  "SK":          "METRIC#weight",
  "itemType":    "MetricSubscription",
  "userId":      "u-7f3a1b2c",
  "metricId":    "weight",
  "isActive":    true,
  "subscribedAt": "2026-03-23T10:00:00.000Z",
  "updatedAt":   "2026-03-23T10:00:00.000Z",
  "currentDailyStreak":      5,
  "maxDailyStreak":          12,
  "currentDailyStreakStart": "2026-03-19",
  "currentWeeklyStreak":     3,
  "maxWeeklyStreak":         8,
  "lastEntryDate":           "2026-03-24",
  "lastEntryWeek":           "2026-W12"
}
```

**`isActive` states:**
| State | Record exists? | `isActive` | Meaning |
|-------|---------------|-----------|--------|
| Never subscribed | ❌ | — | No record; appears in catalog as "Add" |
| Active | ✅ | `true` | Shown on dashboard; excluded from catalog |
| Inactive | ✅ | `false` | Hidden from dashboard; appears in catalog as "Re-activate" |
| Unsubscribed | ❌ (deleted) | — | Record removed; treated as "Never subscribed" |

**Streak fields** (updated server-side on every `PUT /entry`; returned by `GET /subscriptions`):
| Field | Type | Description |
|-------|------|-------------|
| `currentDailyStreak` | number | Consecutive calendar days with ≥1 entry |
| `maxDailyStreak` | number | All-time daily-streak record |
| `currentDailyStreakStart` | string (`YYYY-MM-DD`) | When the current daily run began |
| `currentWeeklyStreak` | number | Consecutive ISO weeks with ≥1 entry |
| `maxWeeklyStreak` | number | All-time weekly-streak record |
| `lastEntryDate` | string (`YYYY-MM-DD`) | Last day an entry was saved |
| `lastEntryWeek` | string (`YYYY-Www`) | Last ISO week an entry was saved |

> Streak is **not** recalculated on DELETE — that would require a full history scan.  
> `subscribedAt` is preserved across deactivate/re-activate cycles (set via `if_not_exists`).  
> `displayOrder` is a reserved optional field for future card reordering.  
> The inverted GSI-2 (see §4.4) answers "who is subscribed to this metric?"  
> `activeCards` array on the user profile is superseded by `isActive` on each subscription record.

---

#### Goal Item

```json
{
  "PK":          "USER#u-7f3a1b2c",
  "SK":          "GOAL#g-4a7b2c1d",
  "itemType":    "Goal",
  "goalId":      "g-4a7b2c1d",
  "metricId":    "steps",
  "userId":      "u-7f3a1b2c",
  "name":        "50,000 steps this week",
  "goalType":    "cumulative",
  "period":      "weekly",
  "periodDays":  null,
  "targetValue": 50000,
  "targetMin":   null,
  "targetMax":   null,
  "direction":   "higher_is_better",
  "aggregation": "sum",
  "streakTarget": null,
  "isActive":    true,
  "startDate":   "2026-03-24",
  "endDate":     null,
  "createdAt":   "2026-03-24T09:00:00.000Z",
  "updatedAt":   "2026-03-24T09:00:00.000Z"
}
```

> All goals for a user are co-located under `PK = "USER#<userId>"` so a single `Query` with `SK begins_with "GOAL#"` retrieves them all.  
> Progress is **not** stored on the Goal item — it is computed on demand by `goal-progress-get` to avoid stale data.  
> `periodDays` is only populated when `period = "rolling"`.

---

### 4.3 Access Patterns

| # | Pattern | DynamoDB operation |
|---|---------|-------------------|
| 1 | Get user profile | `GetItem` PK=`USER#<id>` SK=`#PROFILE` |
| 2 | Save / update user profile | `PutItem` same keys |
| 3 | Get all readings for one metric | `Query` PK=`USER#<id>#METRIC#<name>` |
| 4 | Get readings for one metric in date range | `Query` PK + SK `BETWEEN TS#<start> AND TS#<end>` |
| 5 | Get latest reading for one metric | `Query` PK, `ScanIndexForward=false`, `Limit=1` |
| 6 | Add a new reading | `PutItem` (ts collision on same ms → overwrite is acceptable) |
| 7 | Delete a reading | `DeleteItem` PK + SK |
| 8 | Get all readings for a user across all metrics | `Query` on GSI-1 (see below) |
| 9 | Resolve username → userId | `GetItem` PK=`USERNAME#<name>` SK=`#USER` |
| 10 | Get all credentials for a user | `Query` PK=`USER#<id>` SK `begins_with CRED#` |
| 11 | Get one credential by ID | `GetItem` PK=`USER#<id>` SK=`CRED#<credId>` |
| 12 | Update credential counter after login | `PutItem` (overwrite with new counter) |
| 13 | Store / retrieve pending challenge | `PutItem` / `GetItem` on `PENDING_REG#` or `PENDING_AUTH#` keys |
| 14 | Clean up expired challenges | Automatic — DynamoDB TTL removes items when `ttl` elapses |
| 15 | Get all subscribed metrics for a user | `Query` PK=`USER#<id>`, SK `begins_with METRIC#` |
| 16 | Subscribe a user to a metric (new) | `UpdateItem` with `if_not_exists(subscribedAt)`, `isActive = true` |
| 17 | Deactivate a subscription (hide from dashboard) | `UpdateItem` PK=`USER#<id>` SK=`METRIC#<id>`, set `isActive = false` |
| 18 | Re-activate a subscription | `UpdateItem` same keys, set `isActive = true` |
| 19 | Fully unsubscribe (remove record) | `DeleteItem` PK=`USER#<id>` SK=`METRIC#<metricId>` |
| 20 | Get all subscribers of a metric | `Query` GSI-2, partition key = `METRIC#<metricId>` |
| 21 | Get catalog (available + re-activatable metrics) | `Scan` definitions; exclude `isActive=true` subs; flag `isActive=false` subs as `reactivate: true` |
| 22 | Get a single metric definition | `GetItem` PK=`METRIC#<metricId>` SK=`#DEF` |
| 23 | Seed / update a system metric definition | `PutItem` with `createdBy = "SYSTEM"`, `isPublic = true` |
| 24 | Save a metric entry + update streak | `PutItem` MetricEntry + `UpdateItem` MetricSubscription (streak fields) |
| 25 | Get metric entries for a date range (all metrics) | Parallel `Query` per metric-partition: PK=`USER#<id>#METRIC#<name>`, SK `BETWEEN TS#<from> AND TS#<to>` |
| 26 | Delete a single metric entry | `DeleteItem` PK=`USER#<id>#METRIC#<name>` SK=`TS#<ts>` (no streak recalculation) |
| 27 | Get all goals for a user | `Query` PK=`USER#<id>`, SK `begins_with GOAL#` |
| 28 | Save / update a goal | `PutItem` PK=`USER#<id>` SK=`GOAL#<goalId>` |
| 29 | Delete a goal | `DeleteItem` PK=`USER#<id>` SK=`GOAL#<goalId>` |
| 30 | Compute goal progress | Lambda `goal-progress-get`: `Query` metric entries for the goal's period, aggregate per `goalType` + `aggregation`, return `{ current, target, pct, isOnTrack }` |

---

### 4.4 GSI Definitions

#### GSI-1: `userId-ts-index`

Allows querying all metrics for a user in time order (e.g. for export/import).

| Attribute | Role          |
|-----------|--------------|
| `userId`  | Partition key |
| `ts`      | Sort key      |

**Projected attributes:** ALL
---

#### GSI-2: `metric-subscribers-index` (inverted index)

Answers "which users are subscribed to a given metric?" — used for clinician dashboards,
analytics, and future metric-push features.

This is the classic **inverted index** pattern: the GSI key attributes are the main
table's `SK` (as partition key) and `PK` (as sort key).  
Because `MetricSubscription` items have `SK = "METRIC#<id>"`, querying this GSI with
`SK = "METRIC#weight"` returns every user who subscribed to weight — without needing
a separate attribute.

| GSI attribute | Maps to main-table attribute | Role          |
|--------------|------------------------------|---------------|
| `SK`          | `SK` (e.g. `"METRIC#weight"`)| Partition key |
| `PK`          | `PK` (e.g. `"USER#u-..."`)   | Sort key      |

**Projected attributes:** ALL

> Non-subscription items (profiles, credentials, metric entries) land in this GSI too,
> but their `SK` values (`#PROFILE`, `CRED#…`, `TS#…`, `#DEF`) will never be queried
> so they are harmless phantom entries.
---

## 5. Migration Path

### Phase 1 — Current (localStorage)
- All data lives in four `localStorage` keys: `user`, `activeCards`, `featureFlags`, `records`.
- No auth. Single user per browser.
- `records.dataPoints` is a nested object: `{ [metricName]: { entries: MetricEntry[] } }`.

### Phase 2 — Auth + API Layer
1. Deploy the four auth Lambda functions in `backend/lambdas/` (see `DEPLOY.md`).
2. User registers a passkey → `userId` is generated server-side and returned in the JWT `sub` claim.
3. All subsequent API calls include `Authorization: Bearer <token>` and the Lambda extracts `userId` from the verified JWT.
4. On first login after migration, sync localStorage data up: flatten `records.dataPoints` into individual `PutItem` calls.
5. Replace all `localStorage.getItem/setItem` calls with API service functions.

### Phase 3 — Profile Photo
- Replace base64 data-URL stored in `user.photo` with an S3 presigned upload.
- Store only the S3 object key (`photos/<userId>/profile.jpg`) in the DynamoDB item.
- Serve the photo via CloudFront for caching.

### Data Migration Helper (pseudocode)

```js
// Convert legacy localStorage records → DynamoDB PutItem batch
function flattenRecordsToDynamo(userId, records) {
  const items = [];
  for (const [metric, data] of Object.entries(records.dataPoints)) {
    for (const entry of data.entries) {
      items.push({
        PK: `USER#${userId}#METRIC#${metric}`,
        SK: `TS#${String(entry.ts).padStart(16, '0')}`,
        itemType: 'MetricEntry',
        userId, metric, ...entry,
      });
    }
  }
  return items; // feed to batchWrite (25 items per call max)
}
```

---

## 6. Security Notes

| Risk | Current state | Required fix before production |
|------|--------------|-------------------------------|
| Plaintext passwords in `services[]` | ⚠️ Present in localStorage | Replace with OAuth 2.0 access + refresh tokens. Never store passwords. |
| No authentication | ⚠️ Single browser user | **Passkeys (WebAuthn)** via `@simplewebauthn/server` — see `backend/lambdas/`. No passwords or email required. |
| Photo stored as base64 in localStorage | ⚠️ Large, unencrypted, easy to exfiltrate | Move to S3 + store only the object key. |
| Sensitive health data in localStorage | ⚠️ Accessible to any JS on the page | Only acceptable for prototype. All PHI must go server-side with TLS in transit and encryption at rest (DynamoDB AES-256 default). |
| HIPAA eligibility | ℹ️ Not yet applicable | DynamoDB is HIPAA-eligible. Requires AWS BAA + correct key management (AWS KMS CMK). |

---

## 7. Future Entities

These entities are anticipated but not yet designed:

| Entity | Purpose |
|--------|---------|
| `Program` | A structured health plan (e.g. weight loss program) — backs the **My Programs** section |
| `Circle` | A care group or social health community — backs the **My Circles** section |
| `Notification` | Scheduled reminders to log a metric or take a medication |

| `ProviderConnection` | OAuth token storage for Fitbit, Apple Health, etc. (replaces `services[]`) |
