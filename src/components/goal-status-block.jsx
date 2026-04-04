import { buildGoalSummary } from "./goal-wizard";

/**
 * GoalStatusBlock — universal goal status display used in:
 *   • Goals panel cards (standalone & chain)
 *   • Chain overview dialog
 *   • Dashboard metric card mini-status (compact mode)
 *
 * Shows the goal sentence in italics, then a state-appropriate phrase and
 * a detail line whose wording depends on the metric's tracking flavor:
 *
 *   tracking = 'cumulative' → entries aggregate; "X units to go"
 *   tracking = 'trending'   → single value moves toward target; "X units to go"
 *   tracking = 'spot'       → each reading is independent; "X units away last time"
 *   tracking = null         → defaults to 'trending' behavior
 *
 * State logic:
 *   not-started  prog == null  OR  entryCount === 0
 *   achieved     isOnTrack === true
 *   in-progress  everything else
 */

// ── Phrase banks ─────────────────────────────────────────────────────────────

const PHRASES = {
  achieved: [
    "You did it!",
    "Goal crushed!",
    "Nailed it!",
    "Mission accomplished!",
    "Way to go!",
  ],
  notStarted: [
    "Let's get started!",
    "Ready when you are.",
    "Your journey begins here.",
    "First step awaits!",
    "Time to make it happen!",
  ],
  inProgress: [
    "You're on the way!",
    "Keep it up!",
    "Making progress!",
    "Nice work so far.",
    "Keep going!",
  ],
};

// Stable non-negative hash of a string — same input → same phrase every render
function strHash(s) {
  let h = 0;
  for (let i = 0; i < (s ?? "").length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickPhrase(bank, seed) {
  return bank[strHash(seed) % bank.length];
}

// ── Number formatting ─────────────────────────────────────────────────────────

function fmtDiff(v, uom) {
  const n = Math.abs(+v);
  let s;
  if (n === 0) s = "0";
  else if (n >= 10) s = String(Math.round(n));
  else s = parseFloat(n.toFixed(1)).toString();
  return uom ? `${s}\u2009${uom}` : s;
}

// ── Detail line logic ─────────────────────────────────────────────────────────

function getDetailLine(goal, prog, tracking, uom) {
  const { goalType, direction, aggregation } = goal;
  const { current, target, targetMin, targetMax } = prog;

  // Range: binary framing — user asked for no quantity reference
  if (goalType === "range") return null;

  // Streak: periods remaining
  if (goalType === "streak") {
    if (current == null || target == null) return null;
    const rem = Math.ceil(target - current);
    if (rem <= 0) return null;
    return `${rem} more period${rem !== 1 ? "s" : ""} to go`;
  }

  // Cumulative: always accumulating regardless of metric tracking flavor
  if (goalType === "cumulative") {
    if (current == null || target == null) return null;
    // count aggregation → unit is occurrences, not the metric's uom
    const effectiveUom = aggregation === "count" ? null : uom;
    const fmtCount = (n) => `${Math.abs(Math.round(n))} ${Math.abs(Math.round(n)) === 1 ? "time" : "times"}`;
    if (direction === "lower_is_better") {
      const over = +(current - target);
      if (over <= 0) return null;
      return aggregation === "count"
        ? `${fmtCount(over)} over limit`
        : `${fmtDiff(over, effectiveUom)} over limit`;
    }
    const rem = +(target - current);
    if (rem <= 0) return null;
    return aggregation === "count"
      ? `${fmtCount(rem)} to go`
      : `${fmtDiff(rem, effectiveUom)} to go`;
  }

  // target_value / best_of — phrasing depends on tracking flavor
  if (current == null || target == null) return null;
  const diff =
    direction === "lower_is_better"
      ? +(current - target)
      : +(target - current);
  if (diff <= 0) return null;

  if (tracking === "spot") {
    return `${fmtDiff(diff, uom)} away from your goal last time`;
  }
  // 'trending', 'cumulative', or null → "X to go"
  return `${fmtDiff(diff, uom)} to go`;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {Object}  props
 * @param {Object}  props.goal      Goal object (goalId, name, goalType, direction, …)
 * @param {Object|null} props.prog  Progress object from goal-progress-get (or null = loading)
 * @param {string|null} props.tracking  'cumulative'|'trending'|'spot'|null
 * @param {string}  props.uom       Unit-of-measure label
 * @param {boolean} props.compact    true → single-line phrase for dashboard mini-cards
 * @param {string}  props.metricTitle  Display title of the metric (for summary sentence)
 * @param {string}  props.metricKind   'switch'|'slider'|'singleValue' (for summary sentence)
 */
export function GoalStatusBlock({ goal, prog, tracking = null, uom = "", compact = false, metricTitle = "", metricKind = "" }) {
  const hasData = prog != null && (prog.entryCount ?? 0) > 0;
  const isAchieved = hasData && prog.isOnTrack === true;
  const state = !hasData ? "notStarted" : isAchieved ? "achieved" : "inProgress";

  // Seed includes state so the same goal shows a different phrase per state
  const phrase = pickPhrase(PHRASES[state], `${goal.goalId}-${state}`);
  const detail = state === "inProgress" ? getDetailLine(goal, prog, tracking, uom) : null;

  const COLOR = {
    achieved:   "#10b981",
    notStarted: "#9ca3af",
    inProgress: "#4f46e5",
  };
  const color = COLOR[state];

  if (compact) {
    const summary = buildGoalSummary(goal, metricTitle, metricKind, uom);
    return (
      <div style={{ marginTop: 4 }}>
        <div style={{ fontStyle: "italic", fontSize: 11, color: "#374151", marginBottom: 2, lineHeight: 1.3 }}>
          "{summary || goal.name}"
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color }}>
          {phrase}
          {detail && (
            <span style={{ fontWeight: 400, color: "#6b7280" }}> · {detail}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{
        fontStyle: "italic",
        fontSize: 13,
        color: "#374151",
        marginBottom: 6,
        lineHeight: 1.4,
      }}>
        "{goal.name}"
      </p>
      <div style={{ fontWeight: 600, fontSize: 13, color }}>{phrase}</div>
      {detail && (
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{detail}</div>
      )}
    </div>
  );
}
