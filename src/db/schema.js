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
 * @typedef {'standalone'|'cumulative'} TrackingFlavor
 *
 *   standalone  → each entry stands alone; trend may be observed but every
 *                 reading is individually significant (e.g. weight, heart rate)
 *   cumulative  → entries aggregate toward a period goal; a single reading is
 *                 insignificant on its own (e.g. steps, home-cooked meals)
 *
 * @typedef {'sum'|'count'|'avg'|'max'|'min'} AggregationKind
 *
 * @typedef {Object} GoalTemplate
 * A pre-built goal suggestion attached to a MetricDefinition and offered in the
 * Goal creation wizard so users can start from a sensible default rather than
 * configuring every field from scratch.
 *
 * @property {string}            templateId       - Unique slug within this metric, e.g. "weekly-total"
 * @property {string}            name             - UI label shown in the template picker
 * @property {GoalType}          goalType
 * @property {GoalPeriod}        period
 * @property {GoalDirection}     direction
 * @property {AggregationKind}   aggregation
 * @property {number|null}       [suggestedTarget]  - Pre-populates the target field; user may change
 * @property {number|null}       [suggestedMin]     - range goals: pre-populates targetMin
 * @property {number|null}       [suggestedMax]     - range goals: pre-populates targetMax
 * @property {number|null}       [suggestedStreak]  - streak goals: pre-populates streakTarget
 *
 * @typedef {Object} MetricDefinition
 * @property {string}             metricId           - Slug-style id, e.g. "blood-glucose"
 * @property {string}             friendlyName       - Display label, e.g. "Blood Glucose"
 * @property {string}             icon               - Lucide icon name from the allowed set
 * @property {string}             infoUrl            - Optional http/https reference URL
 * @property {'numeric'|'boolean'|'string'} valueType
 * @property {boolean}            isPublic           - Whether visible to all users in the catalogue
 * @property {string}             createdBy          - userId of creator, or "SYSTEM"
 * @property {string}             updatedAt          - ISO-8601 last-write timestamp
 * @property {TrackingFlavor|null}  [trackingFlavor]     - UI hint: how entries are naturally consumed.
 *                                                         null = no strong convention (user decides).
 * @property {AggregationKind|null} [defaultAggregation] - UI hint: pre-select in Goal creation
 *                                                         dialog; does not restrict user choice.
 * @property {GoalTemplate[]}     [goalTemplates]    - Ordered list of suggested goal templates
 *                                                     shown in the Goal creation wizard.
 *                                                     Empty array = no templates (start from scratch).
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
  metricId:           "",
  friendlyName:       "",
  icon:               "Activity",
  infoUrl:            "",
  valueType:          "numeric",
  isPublic:           false,
  createdBy:          "",
  updatedAt:          "",
  trackingFlavor:     null,
  defaultAggregation: null,
  goalTemplates:      [],
};

// ─── Goal templates for system metrics ───────────────────────────────────────

/**
 * Suggested goal templates for each system metric.
 * These are seeded into the MetricDefinition items in DynamoDB and are also
 * available here for the frontend prototype (no network round-trip required).
 *
 * @type {{ [metricName: string]: GoalTemplate[] }}
 */
export const METRIC_GOAL_TEMPLATES = {
  weight: [
    { templateId: "weight-target",   name: "Reach target weight",      goalType: "target_value", period: "all_time", direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: null },
    { templateId: "weight-range",    name: "Stay within weight range",  goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: null, suggestedMax: null },
  ],
  heart: [
    { templateId: "heart-target",    name: "Lower resting heart rate",  goalType: "best_of",      period: "monthly",  direction: "lower_is_better",  aggregation: "min",  suggestedTarget: 60 },
    { templateId: "heart-range",     name: "Keep HR in healthy zone",   goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: 50, suggestedMax: 100 },
  ],
  glucose: [
    { templateId: "glucose-range",   name: "Time in Range (70–140)",    goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: 70, suggestedMax: 140 },
    { templateId: "glucose-target",  name: "Lower fasting glucose",     goalType: "target_value", period: "all_time", direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 100 },
  ],
  systolic: [
    { templateId: "systolic-range",  name: "Keep systolic in range",    goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: 90, suggestedMax: 120 },
    { templateId: "systolic-target", name: "Reach systolic target",     goalType: "target_value", period: "all_time", direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 120 },
  ],
  diastolic: [
    { templateId: "diastolic-range", name: "Keep diastolic in range",   goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: 60, suggestedMax: 80 },
  ],
  temperature: [
    { templateId: "temp-range",      name: "Stay in normal range",      goalType: "range",        period: "weekly",   direction: "exact",            aggregation: "avg",  suggestedMin: 97.8, suggestedMax: 99.1 },
  ],
  pain: [
    { templateId: "pain-below",      name: "Keep pain below level",     goalType: "target_value", period: "weekly",   direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 3 },
    { templateId: "pain-streak",     name: "Pain-free days streak",     goalType: "streak",       period: "all_time", direction: "lower_is_better",  aggregation: "count", suggestedStreak: 7 },
  ],
  tired: [
    { templateId: "tired-below",     name: "Keep tiredness below level",goalType: "target_value", period: "weekly",   direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 4 },
  ],
  headache: [
    { templateId: "headache-below",  name: "Keep headaches below level",goalType: "target_value", period: "weekly",   direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 2 },
  ],
  back: [
    { templateId: "back-below",      name: "Keep back pain below level",goalType: "target_value", period: "weekly",   direction: "lower_is_better",  aggregation: "avg",  suggestedTarget: 3 },
  ],
  tylenol: [
    { templateId: "tylenol-weekly",  name: "Limit Tylenol doses per week", goalType: "cumulative", period: "weekly",  direction: "lower_is_better",  aggregation: "count", suggestedTarget: 3 },
    { templateId: "tylenol-comply",  name: "Take Tylenol as prescribed", goalType: "cumulative",  period: "weekly",  direction: "higher_is_better", aggregation: "count", suggestedTarget: 7 },
  ],
  losartan: [
    { templateId: "losartan-comply", name: "Take Losartan daily",        goalType: "streak",      period: "all_time", direction: "higher_is_better", aggregation: "count", suggestedStreak: 30 },
    { templateId: "losartan-weekly", name: "Take Losartan 7 days/week",  goalType: "cumulative",  period: "weekly",   direction: "higher_is_better", aggregation: "count", suggestedTarget: 7 },
  ],
};

// ─── Goal (a target attached to a metric) ────────────────────────────────────

/**
 * A user-defined target for a metric over an optional time window.
 *
 * goalType controls which fields are meaningful:
 *
 *   target_value  → single reading must reach targetValue
 *                   (e.g. "weigh 160 lbs")
 *   cumulative    → sum/count of entries in period must reach targetValue
 *                   (e.g. "walk 50,000 steps this week",
 *                    "cook at home 5 times this week" — boolean metric,
 *                    aggregation:"count", targetValue:5)
 *   range         → readings must stay inside [targetMin, targetMax]
 *                   (e.g. "keep glucose 70–140 mg/dL")
 *   streak        → consecutive days/weeks with ≥1 entry must reach streakTarget
 *                   (e.g. "meditate 30 days in a row")
 *   best_of       → beat personal best; direction determines better/worse
 *                   (e.g. "run a mile under 8 min",
 *                    "achieve resting HR ≤ 55 bpm")
 *
 * @typedef {'target_value'|'cumulative'|'range'|'streak'|'best_of'} GoalType
 * @typedef {'daily'|'weekly'|'monthly'|'rolling'|'all_time'} GoalPeriod
 * @typedef {'lower_is_better'|'higher_is_better'|'exact'} GoalDirection
 *
 * @typedef {Object} Goal
 * @property {string}          goalId        - UUID, e.g. "g-4a7b2c1d"
 * @property {string}          metricId      - FK → MetricDefinition
 * @property {string}          userId        - FK → User
 * @property {string}          name          - Friendly label shown in the UI
 * @property {GoalType}        goalType
 * @property {GoalPeriod}      period        - Evaluation window
 * @property {number|null}     periodDays    - Only used when period = "rolling"
 * @property {number|null}     targetValue   - Used by target_value / cumulative / best_of
 * @property {number|null}     targetMin     - Used by range
 * @property {number|null}     targetMax     - Used by range
 * @property {GoalDirection}   direction     - Which way is progress?
 * @property {AggregationKind} aggregation   - How entries are combined for evaluation
 * @property {number|null}     streakTarget  - Used by streak (number of consecutive days)
 * @property {boolean}         isActive
 * @property {string}          startDate     - ISO date "YYYY-MM-DD"
 * @property {string|null}     endDate       - ISO date, or null for ongoing
 * @property {string}          createdAt     - ISO-8601
 * @property {string}          updatedAt     - ISO-8601
 */
export const GOAL_DEFAULTS = {
  goalId:        "",
  metricId:      "",
  userId:        "",
  name:          "",
  goalType:      "target_value",   // 'target_value'|'cumulative'|'range'|'streak'|'best_of'
  period:        "weekly",         // 'daily'|'weekly'|'monthly'|'rolling'|'all_time'
  periodDays:    null,
  targetValue:   null,
  targetMin:     null,
  targetMax:     null,
  direction:     "lower_is_better", // 'lower_is_better'|'higher_is_better'|'exact'
  aggregation:   "sum",             // 'sum'|'count'|'avg'|'max'|'min'
  streakTarget:  null,
  isActive:      true,
  startDate:     "",
  endDate:       null,
  createdAt:     "",
  updatedAt:     "",
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
  // ── Streak tracking ────────────────────────────────────────────────────────
  // Stored directly on the subscription record so no extra API call is needed
  // at login — streak data comes back automatically with GET /subscriptions.
  currentDailyStreak:      0,     // consecutive calendar days with ≥1 entry
  maxDailyStreak:          0,     // all-time record
  currentDailyStreakStart: null,  // 'YYYY-MM-DD' when current daily run began
  currentWeeklyStreak:     0,     // consecutive ISO weeks with ≥1 entry
  maxWeeklyStreak:         0,     // all-time record
  lastEntryDate:           null,  // 'YYYY-MM-DD' of last saved entry (used server-side for streak math)
  lastEntryWeek:           null,  // 'YYYY-Www' (ISO week) of last saved entry
};

// ─── localStorage key registry ────────────────────────────────────────────────

/**
 * All keys used in localStorage.
 * Import this instead of hard-coding strings to avoid typo bugs.
 */
export const LS_KEYS = {
  USER:          "user",
  ACTIVE_CARDS:  "activeCards",
  FEATURE_FLAGS: "featureFlags",
  CUSTOM_METRICS: "customMetrics",
};
