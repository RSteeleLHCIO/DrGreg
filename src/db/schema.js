/**
 * @file schema.js
 * @description Canonical data shapes for the TobbiHealth app.
 *
 * These exported defaults serve two purposes:
 *   1. Single source of truth for every object shape used in the app.
 *   2. Safe seed values — spread these when initialising localStorage or
 *      hydrating a new DynamoDB item so no field is ever undefined.
 *
 * When you add a field anywhere in the app, add it here first.
 */

// ─── User ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ServiceLink
 * @property {string} provider  - Display name, e.g. "Fitbit", "Apple Health"
 * @property {string} username  - Username or email for the linked account
 * @property {string} linkedAt  - ISO-8601 timestamp of when the link was made
 *
 * NOTE: Passwords must NOT be stored here when the backend is implemented.
 * Replace with OAuth tokens (see schema.md §Security).
 */
export const SERVICE_LINK_DEFAULTS = {
  provider: "",
  username: "",
  linkedAt: "",
};

/**
 * @typedef {Object} User
 * @property {string}        firstName  - Given name
 * @property {string}        lastName   - Family name
 * @property {string}        dob        - Date of birth, ISO date "YYYY-MM-DD"
 * @property {string|null}   photo      - Base64 data-URL of profile photo, or null
 * @property {ServiceLink[]} services   - Connected third-party health services
 */
export const USER_DEFAULTS = {
  firstName: "",
  lastName: "",
  dob: "",
  photo: null,
  services: [],
};

// ─── Metric entry (a single timestamped reading) ────────────────────────────

/**
 * @typedef {'manual entry'|'Fitbit'|'Apple Health'|'Google Fit'|'Withings'|'Oura'|'Dexcom'|'Omron Connect'} EntrySource
 */

/**
 * @typedef {Object} MetricEntry
 * @property {number}           ts         - Unix timestamp in **milliseconds**
 * @property {number|boolean}   value      - The recorded value.
 *                                           number  → singleValue / slider metrics
 *                                           boolean → switch (medication taken) metrics
 * @property {string}           updatedAt  - ISO-8601 datetime the record was last written
 * @property {EntrySource}      source     - How/where the reading originated
 */
export const METRIC_ENTRY_DEFAULTS = {
  ts: 0,
  value: null,
  updatedAt: "",
  source: "manual entry",
};

// ─── Per-metric data bucket ──────────────────────────────────────────────────

/**
 * @typedef {Object} MetricData
 * @property {MetricEntry[]} entries   - Time-ordered array of all readings
 *
 * NOTE: The legacy `dayValue` map (keyed by ts-as-string) that appears in some
 * early records is deprecated. New writes use `entries` only.
 */
export const METRIC_DATA_DEFAULTS = {
  entries: [],
};

// ─── Records document ────────────────────────────────────────────────────────

/**
 * All metric data for one user, keyed by metric name.
 *
 * Supported metric names (keys of dataPoints):
 *   weight, heart, glucose, systolic, diastolic,
 *   temperature, tired, headache, back, tylenol, losartan, pain
 *
 * @typedef {Object} RecordsDocument
 * @property {{ [metricName: string]: MetricData }} dataPoints
 */
export const RECORDS_DEFAULTS = {
  dataPoints: {},
};

// ─── Active dashboard cards ───────────────────────────────────────────────────

/**
 * Ordered list of card names visible on the My Data dashboard.
 * Each string must be a valid `cardName` from CARD_DEFINITIONS.
 *
 * @type {string[]}
 */
export const ACTIVE_CARDS_DEFAULTS = [
  "weight",
  "symptoms",
  "heart",
  "temperature",
  "blood-pressure",
  "glucose",
  "tired",
  "headache",
  "back",
  "tylenol",
  "losartan",
];

// ─── Feature flags ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FeatureFlags
 * @property {boolean} paidVersion  - Unlocks premium features
 */
export const FEATURE_FLAGS_DEFAULTS = {
  paidVersion: false,
};

// ─── Metric configuration (UI metadata) ──────────────────────────────────────

/**
 * @typedef {'singleValue'|'slider'|'switch'} MetricKind
 *
 *   singleValue → free numeric input
 *   slider      → 0–10 scale
 *   switch      → boolean yes/no (medication taken)
 */

/**
 * @typedef {Object} MetricConfig
 * @property {string}      title   - Display name shown in the UI
 * @property {MetricKind}  kind    - Which input widget to render
 * @property {string}      uom     - Unit of measure label (empty string if none)
 * @property {string}      [prompt] - Optional question text shown in the entry dialog
 */

/** @type {{ [metricName: string]: MetricConfig }} */
export const METRIC_CONFIG = {
  weight:      { title: "Weight",         kind: "singleValue", uom: "lbs" },
  heart:       { title: "Heart Rate",     kind: "singleValue", uom: "bpm",   prompt: "What is your Heart Rate (beats per minute)?" },
  glucose:     { title: "Blood Glucose",  kind: "singleValue", uom: "mg/dL", prompt: "What is your Blood Glucose (sugar) level?" },
  systolic:    { title: "BP – Systolic",  kind: "singleValue", uom: "mmHg" },
  diastolic:   { title: "BP – Diastolic", kind: "singleValue", uom: "mmHg" },
  temperature: { title: "Temperature",    kind: "singleValue", uom: "°F" },
  pain:        { title: "Pain",           kind: "slider",      uom: "",     prompt: "How bad is your pain today?" },
  tired:       { title: "Tiredness",      kind: "slider",      uom: "",     prompt: "How tired do you feel today?" },
  headache:    { title: "Headache",       kind: "slider",      uom: "",     prompt: "How bad is your headache today?" },
  back:        { title: "Back Pain",      kind: "slider",      uom: "",     prompt: "How bad is your back pain today?" },
  tylenol:     { title: "Rx – Tylenol",   kind: "switch",      uom: "",     prompt: "Did you take Tylenol within the last 4 hours?" },
  losartan:    { title: "Rx – Losartan",  kind: "switch",      uom: "",     prompt: "Did you take Losartan today?" },
};

// ─── Metric definition (the catalogue entry for a metric) ────────────────────

/**
 * Describes a metric that can be tracked.
 *
 * System-provided metrics:  isPublic = true,  createdBy = "SYSTEM"
 * User-created metrics:     isPublic = false, createdBy = <userId>
 *
 * @typedef {Object} MetricDefinition
 * @property {string}  metricId      - Slug-style id, e.g. "blood-glucose"
 * @property {string}  friendlyName  - Display label, e.g. "Blood Glucose"
 * @property {string}  icon          - Lucide icon name from the allowed set
 * @property {string}  infoUrl       - Optional http/https reference URL
 * @property {'numeric'|'boolean'|'string'} valueType
 * @property {boolean} isPublic      - Whether visible to all users in the catalogue
 * @property {string}  createdBy     - userId of creator, or "SYSTEM"
 * @property {string}  updatedAt     - ISO-8601 last-write timestamp
 *
 * -- numeric only --
 * @property {boolean} [sliderEnabled]
 * @property {string}  [uom]
 * @property {number}  [logicalMin]
 * @property {number}  [logicalMax]
 *
 * -- boolean only --
 * @property {string}  [falseTag]
 * @property {string}  [trueTag]
 */
export const METRIC_DEFINITION_DEFAULTS = {
  metricId:     "",
  friendlyName: "",
  icon:         "Activity",
  infoUrl:      "",
  valueType:    "numeric",
  isPublic:     false,
  createdBy:    "",
  updatedAt:    "",
};

// ─── Metric subscription (user ↔ metric join record) ─────────────────────────

/**
 * Records that a user has subscribed to a particular metric.
 *
 * DynamoDB key pattern:
 *   PK = "USER#<userId>"
 *   SK = "METRIC#<metricId>"
 *
 * Query "all metrics for a user":
 *   Main table, PK = "USER#<id>", SK begins_with "METRIC#"
 *
 * Query "all subscribers for a metric" (future / admin use):
 *   GSI-2 (inverted index), partition key = "METRIC#<id>"
 *
 * Subscription states:
 *   No record        → never subscribed
 *   isActive: true   → subscribed and visible on dashboard
 *   isActive: false  → subscribed but hidden from dashboard ("removed from dashboard")
 *
 * The original subscribedAt is preserved across deactivate/re-activate cycles.
 * displayOrder is optional and reserved for future card reordering.
 *
 * @typedef {Object} MetricSubscription
 * @property {string}  userId        - The subscribing user
 * @property {string}  metricId      - The subscribed metric
 * @property {boolean} isActive      - Whether the card appears on the dashboard
 * @property {string}  subscribedAt  - ISO-8601 timestamp of original subscription
 * @property {string}  updatedAt     - ISO-8601 timestamp of last isActive change
 * @property {number}  [displayOrder] - Optional card sort position (reserved)
 */
export const METRIC_SUBSCRIPTION_DEFAULTS = {
  userId:       "",
  metricId:     "",
  isActive:     true,
  subscribedAt: "",
  updatedAt:    "",
};

// ─── localStorage key registry ────────────────────────────────────────────────

/**
 * All keys used in localStorage.
 * Import this instead of hard-coding strings to avoid typo bugs.
 */
export const LS_KEYS = {
  USER:         "user",
  ACTIVE_CARDS: "activeCards",
  FEATURE_FLAGS: "featureFlags",
  RECORDS:      "records",
};
