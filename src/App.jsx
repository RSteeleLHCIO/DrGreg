import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, Moon, Brain, Bone, Edit, Pill, Settings, Plus, Clock, Thermometer, Download, Upload, User, Link, Users, Target, Home, Camera, LogOut, MoreVertical, Flag, Trash2, CheckCircle2, Sun, ChevronLeft } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import { Slider } from "./components/ui/slider";
import { Label } from "./components/ui/label";
import { Calendar } from "./components/ui/calendar";
import { toKey, fmtTime, fmtDateTime, toSentenceCase } from "./utils/helpers";
import { METRIC_GOAL_TEMPLATES, GOAL_DEFAULTS, PROGRAM_ITEM_DEFAULTS } from './db/schema';
import LoginScreen from "./components/login-screen";
import ProfileSetup from "./components/profile-setup";
import { GoalWizard } from "./components/goal-wizard";

// Icon map for custom metric definitions (icon name → component)
const METRIC_ICONS = { Activity, Heart, Droplet, Gauge, Moon, Brain, Bone, Thermometer, Pill, Target, Clock, User };

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || '';
}

// Minor words that stay lowercase unless they're the first word
const TITLE_CASE_MINOR = new Set(['a','an','and','as','at','but','by','for','from',
  'in','into','nor','of','off','on','onto','or','out','over','per','so','the',
  'to','up','via','with','yet']);
function toTitleCase(str) {
  return str.trim().replace(/\S+/g, (word, offset) => {
    const lower = word.toLowerCase();
    return (offset === 0 || !TITLE_CASE_MINOR.has(lower))
      ? lower.charAt(0).toUpperCase() + lower.slice(1)
      : lower;
  });
}

// Returns a human-friendly progress label for any goal type.
// fmtV(v) should return "v uom" (already formatted).
function goalProgressLabel(goalType, direction, prog, fmtV) {
  if (!prog) return null;
  const { current, target, targetMin, targetMax, pct, isOnTrack, entryCount, inRangeCount } = prog;

  if (goalType === 'target_value') {
    if (current == null) return null;
    const diff = Math.abs(+current - +target);
    return diff === 0 ? 'Goal reached!' : `${fmtV(diff)} to go`;
  }

  if (goalType === 'cumulative') {
    if (current == null || target == null) return null;
    if (direction === 'lower_is_better') {
      const over = +(current - target).toFixed(4);
      return over <= 0 ? 'Within limit!' : `${fmtV(Math.abs(over))} over limit`;
    }
    const rem = +(target - current).toFixed(4);
    return rem <= 0 ? 'Goal met!' : `${fmtV(rem)} to go`;
  }

  if (goalType === 'streak') {
    if (current == null || target == null) return null;
    const rem = target - current;
    return rem <= 0 ? 'Streak goal reached!' : `${rem} more day${rem !== 1 ? 's' : ''}`;
  }

  if (goalType === 'range') {
    if (current == null || targetMin == null || targetMax == null) return null;
    if (current >= targetMin && current <= targetMax) return 'In range — keep it up!';
    const rangeWidth = targetMax - targetMin;
    const soCloseThreshold = rangeWidth * 0.15;
    if (current > targetMax) {
      const over = current - targetMax;
      return over <= soCloseThreshold ? `Just ${fmtV(over)} above — so close!` : `${fmtV(over)} above range`;
    }
    const under = targetMin - current;
    return under <= soCloseThreshold ? `Just ${fmtV(under)} below — so close!` : `${fmtV(under)} below range`;
  }

  if (goalType === 'best_of') {
    if (current == null || target == null) return null;
    const diff = direction === 'lower_is_better' ? current - target : target - current;
    return diff <= 0 ? 'Personal best!' : `${fmtV(diff)} to beat your best`;
  }

  return null;
}

function NestedRingsLogo({ size = 40, highlight = 'none', strokeColor = 'white', fillColor, strokeOpacity = 0.75, className, style }) {
  const fc = fillColor ?? strokeColor;
  const maskId = `nrl-${highlight}-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} style={style}>
      <defs>
        {highlight === 'programs' && (
          <mask id={maskId}>
            <circle cx="50" cy="58" r="36" fill="white" />
            <circle cx="50" cy="66" r="28" fill="black" />
          </mask>
        )}
        {highlight === 'circles' && (
          <mask id={maskId}>
            <circle cx="50" cy="50" r="44" fill="white" />
            <circle cx="50" cy="58" r="36" fill="black" />
          </mask>
        )}
      </defs>
      {highlight === 'data' && <circle cx="50" cy="66" r="28" fill={fc} />}
      {highlight === 'programs' && <rect width="100" height="100" fill={fc} mask={`url(#${maskId})`} />}
      {highlight === 'circles' && <rect width="100" height="100" fill={fc} mask={`url(#${maskId})`} />}
      <circle cx="50" cy="50" r="44" stroke={strokeColor} strokeWidth="2.5" strokeOpacity={strokeOpacity} />
      <circle cx="50" cy="58" r="36" stroke={strokeColor} strokeWidth="2" strokeOpacity={strokeOpacity} />
      <circle cx="50" cy="66" r="28" stroke={strokeColor} strokeWidth="2.5" strokeOpacity={strokeOpacity} />
    </svg>
  );
}

export default function App() {

  // Auth — JWT stored in sessionStorage (cleared when tab closes)
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem("authToken"));
  // 'loading' while fetching profile, 'setup' if no profile found, 'ready' otherwise
  const [profileReady, setProfileReady] = useState(() => sessionStorage.getItem("authToken") ? "loading" : "ready");
  const [authUsername, setAuthUsername] = useState("");

  const API = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

  async function fetchAndApplyProfile(token) {
    try {
      const res = await fetch(`${API}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      const { profile } = await res.json();
      if (!profile) {
        setProfileReady("setup");
        return;
      }
      // Merge fetched profile into local user state
      setUser(prev => {
        const merged = { ...prev, ...profile, services: prev.services ?? [] };
        try { localStorage.setItem("user", JSON.stringify(merged)); } catch { }
        return merged;
      });
      setProfileReady("ready");
    } catch {
      // Network error — fall back to whatever is in localStorage
      setProfileReady("ready");
    }
    // Hydrate metricConfig with full definitions (including logicalMin/logicalMax)
    // from the backend, regardless of what's in localStorage.
    fetchAndApplySubscriptions(token);
    // Load the most recent 7 days of entry data.
    fetchAndApplyEntries(token);
    // Load saved goals for this user.
    fetchAndApplyGoals(token);
    // Load program enrolments.
    fetchAndApplyEnrollments(token);
    // Load user's programs.
    fetchAndApplyPrograms(token);
  }

  async function fetchAndApplyEntries(token) {
    try {
      const to   = Date.now();
      const from = to - 7 * 24 * 60 * 60 * 1000;
      const res  = await fetch(`${API}/entries?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { entries } = await res.json();
      if (!entries || !Object.keys(entries).length) return;

      const dataPoints = {};
      for (const [metric, arr] of Object.entries(entries)) {
        if (!Array.isArray(arr) || !arr.length) continue;
        const sorted = [...arr].sort((a, b) => a.ts - b.ts);
        const dayValue = {};
        sorted.forEach(e => { dayValue[String(e.ts)] = { value: e.value, updatedAt: e.updatedAt, source: e.source }; });
        dataPoints[metric] = { entries: sorted, dayValue };
      }
      setRecords({ dataPoints });
    } catch {
      // Silently ignore — UI remains with whatever is in memory.
    }
  }

  async function fetchAndApplyGoals(token) {
    try {
      const res = await fetch(`${API}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { goals: list } = await res.json();
        const goalList = list ?? [];
        setGoals(goalList);
        const active = goalList.filter(g => g.isActive);
        if (active.length > 0) fetchGoalProgress(token, active);
      }
    } catch {}
  }

  async function fetchAndApplyEnrollments(token) {
    try {
      const res = await fetch(`${API}/programs/enrolled`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { enrollments: list } = await res.json();
        setEnrollments(list ?? []);
      }
    } catch {}
  }

  async function fetchAndApplyPrograms(token) {
    try {
      const res = await fetch(`${API}/programs/catalog`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { programs: list } = await res.json();
        // Keep only programs owned by this user (personal type)
        const userId = user?.userId ?? user?.sub;
        setPrograms((list ?? []).filter(p => p.programType === 'personal' && p.createdBy === userId));
      }
    } catch {}
  }

  async function fetchGoalProgress(token, goalList) {
    const settled = await Promise.allSettled(
      goalList.map(g =>
        fetch(`${API}/goal/progress?goalId=${encodeURIComponent(g.goalId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null)
      )
    );
    const map = {};
    goalList.forEach((g, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled' && r.value) map[g.goalId] = r.value;
    });
    setGoalProgress(prev => ({ ...prev, ...map }));
  }

  async function fetchAndApplySubscriptions(token) {
    try {
      const res = await fetch(`${API}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { subscriptions } = await res.json();
      if (!subscriptions?.length) return;

      const configUpdates = {};
      const cardUpdates = [];

      for (const def of subscriptions) {
        const kind = def.valueType === 'boolean' ? 'switch'
                   : (def.valueType === 'numeric' && def.sliderEnabled) ? 'slider'
                   : def.valueType === 'string' ? 'text'
                   : 'singleValue';
        configUpdates[def.metricId] = {
          title: def.friendlyName,
          kind,
          uom: def.uom || '',
          _icon: def.icon || 'Activity',
          ...(def.infoUrl ? { infoUrl: def.infoUrl } : {}),
          ...(kind === 'slider' ? { logicalMin: def.logicalMin ?? 0, logicalMax: def.logicalMax ?? 10 } : {}),
          ...(kind === 'switch' ? { falseTag: def.falseTag || 'No', trueTag: def.trueTag || 'Yes' } : {}),
          trackingFlavor:      def.trackingFlavor      ?? null,
          defaultAggregation:  def.defaultAggregation  ?? null,
          currentDailyStreak:  def.currentDailyStreak  ?? 0,
          currentWeeklyStreak: def.currentWeeklyStreak ?? 0,
        };
        cardUpdates.push({
          cardName: def.metricId,
          title: def.friendlyName,
          icon: METRIC_ICONS[def.icon] ?? Activity,
          metricNames: [def.metricId],
        });
      }

      setMetricConfig(configUpdates);
      setCardDefinitions(cardUpdates);
      const newIds = cardUpdates.map(c => c.cardName);
      setActiveCards(prev => {
        const preserved = prev.filter(id => newIds.includes(id));
        const added = newIds.filter(id => !prev.includes(id));
        const next = [...preserved, ...added];
        try { localStorage.setItem('activeCards', JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {
      // Silently ignore — localStorage remains the fallback.
    }
  }

  // On mount, if we already have a token (tab restored), load the profile
  React.useEffect(() => {
    const token = sessionStorage.getItem("authToken");
    if (token) fetchAndApplyProfile(token);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfileToBackend(token, profileData) {
    const res = await fetch(`${API}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save profile");
    }
  }

  // Upload a photo File to S3 via the Lambda proxy; returns the permanent public URL.
  // Routing through our Lambda avoids all S3 CORS complexity.
  async function uploadPhoto(file, token) {
    const contentType = file.type || "image/jpeg";
    // Read as base64 and strip the data-URL prefix
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = (e) => resolve(e.target.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res = await fetch(`${API}/photo-upload`, {
      method: "PUT",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ image: base64, contentType }),
    });
    if (!res.ok) throw new Error("Photo upload failed");
    const { publicUrl } = await res.json();
    return publicUrl;
  }

  function handleAuth(token, username) {
    sessionStorage.setItem("authToken", token);
    setAuthToken(token);
    setAuthUsername(username);
    setProfileReady("loading");
    fetchAndApplyProfile(token);
  }

  // User profile — loaded from the backend on login; cached in localStorage between sessions.
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { services: [], ...parsed };
      }
    } catch { }
    return {
      firstName: "",
      lastName: "",
      dob: "",
      services: [],
    };
  });

  // Major section: null = home screen, 'my-data', 'my-programs', 'my-circles'
  const [activeSection, setActiveSection] = useState(null);

  // metricConfig is populated entirely from the backend via fetchAndApplySubscriptions.
  const [metricConfig, setMetricConfig] = useState({});

  // cardDefinitions is populated entirely from the backend via fetchAndApplySubscriptions.
  const [cardDefinitions, setCardDefinitions] = useState([]);

  const [activeCards, setActiveCards] = useState(() => {
    try {
      const raw = localStorage.getItem("activeCards");
      if (raw) return JSON.parse(raw);
    } catch { }
    return [];
  });

  // Entry data is loaded from the backend after login via fetchAndApplyEntries().
  const [records, setRecords] = useState({ dataPoints: {} });

  // --- Selected day ----------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);

  // Track which time window has already been loaded so we only fetch new data
  // when the user navigates past the currently loaded window.
  const loadedRangeRef = useRef({ from: Date.now() - 7 * 24 * 60 * 60 * 1000, to: Date.now() });

  // Lazy-load entries when navigating to a date outside the loaded window.
  useEffect(() => {
    if (!authToken) return;
    const selTs = selectedDate.getTime();
    if (selTs >= loadedRangeRef.current.from) return; // already loaded

    // The user has navigated before the loaded window — fetch that 7-day block.
    const blockTo   = new Date(selTs); blockTo.setHours(23, 59, 59, 999);
    const blockFrom = new Date(selTs); blockFrom.setDate(blockFrom.getDate() - 6); blockFrom.setHours(0, 0, 0, 0);
    const fromTs = blockFrom.getTime();
    const toTs   = blockTo.getTime();

    // Expand the tracked window immediately to prevent duplicate fetches
    loadedRangeRef.current.from = Math.min(loadedRangeRef.current.from, fromTs);

    fetch(`${API}/entries?from=${fromTs}&to=${toTs}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ entries }) => {
        if (!entries || !Object.keys(entries).length) return;
        setRecords(prev => {
          const updated = { ...prev.dataPoints };
          for (const [metric, arr] of Object.entries(entries)) {
            if (!Array.isArray(arr) || !arr.length) continue;
            const existing  = updated[metric] ?? { entries: [], dayValue: {} };
            const tsSet     = new Set((existing.entries ?? []).map(e => e.ts));
            const merged    = [...(existing.entries ?? [])];
            const dv        = { ...(existing.dayValue ?? {}) };
            for (const e of arr) {
              if (!tsSet.has(e.ts)) merged.push(e);
              dv[String(e.ts)] = { value: e.value, updatedAt: e.updatedAt, source: e.source };
            }
            merged.sort((a, b) => a.ts - b.ts);
            updated[metric] = { ...existing, entries: merged, dayValue: dv };
          }
          return { ...prev, dataPoints: updated };
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const calendarButtonRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Update metric values in the records (timestamped entries)
  // newData: { metric, inputValue, ts, editTs, source }
  const updateDayValues = (newData) => {
    const ts     = typeof newData.ts === 'number' ? newData.ts : Date.now();
    const source = newData.source || 'manual entry';

    // Fire-and-forget backend persistence.
    if (authToken) {
      // For edits: delete the old entry then write the new one.
      if (typeof newData.editTs === 'number' && newData.editTs !== ts) {
        fetch(`${API}/entry`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ metric: newData.metric, ts: newData.editTs }),
        }).catch(() => {});
      }
      fetch(`${API}/entry`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ metric: newData.metric, ts, value: newData.inputValue, source }),
      }).then(r => r.ok ? r.json() : null).then(data => {
        if (!data) return;
        const { currentDailyStreak, currentWeeklyStreak } = data;
        if (currentDailyStreak == null && currentWeeklyStreak == null) return;
        setMetricConfig(prev => {
          const existing = prev[newData.metric];
          if (!existing) return prev;
          return {
            ...prev,
            [newData.metric]: {
              ...existing,
              currentDailyStreak:  currentDailyStreak  ?? existing.currentDailyStreak,
              currentWeeklyStreak: currentWeeklyStreak ?? existing.currentWeeklyStreak,
            },
          };
        });
      }).catch(() => {});
    }

    setRecords((prev) => {
      const metricKey = newData.metric;
      const dp = prev.dataPoints[metricKey] ?? {};
      let entries = Array.isArray(dp.entries) ? [...dp.entries] : [];
      const updatedAt = new Date().toISOString();

      // Also persist into legacy dayValue map but keyed by timestamp (string)
      const dv = { ...(dp.dayValue ?? {}) };

      // If editing an existing entry, remove the old one and its legacy map entry
      if (typeof newData.editTs === 'number') {
        entries = entries.filter(e => e.ts !== newData.editTs);
        if (dv.hasOwnProperty(String(newData.editTs))) {
          delete dv[String(newData.editTs)];
        }
      }

      // Add the new/updated entry and re-sort
      entries.push({ ts, value: newData.inputValue, updatedAt, source });
      entries.sort((a, b) => a.ts - b.ts);

      // Update legacy map with the new timestamp key
      dv[String(ts)] = { value: newData.inputValue, updatedAt, source };

      const updatedDataPoints = {
        ...prev.dataPoints,
        [metricKey]: {
          ...dp,
          entries,
          // maintain legacy dayValue, with new timestamp-based keys
          dayValue: dv
        }
      };
      return { ...prev, dataPoints: updatedDataPoints };
    });
  };

  // --- Dialog state ----------------------------------------------------------
  const [open, setOpen] = useState(null);

  // --- Card kebab menu state ------------------------------------------------
  const [cardMenuOpen, setCardMenuOpen] = useState(null); // cardName | null

  useEffect(() => {
    if (!cardMenuOpen) return;
    const close = (e) => {
      if (!e.target.closest('.card-menu-popup') && !e.target.closest('.card-menu-btn')) {
        setCardMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [cardMenuOpen]);

  async function handleDeactivateCard(cardName, metricId) {
    const next = activeCards.filter(c => c !== cardName);
    setActiveCards(next);
    try { localStorage.setItem('activeCards', JSON.stringify(next)); } catch {}
    setCardMenuOpen(null);
    if (authToken) {
      fetch(`${API}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ metricId, isActive: false }),
      }).catch(() => {});
    }
  }

  async function handleUnsubscribeCard(cardName, metricId) {
    const next = activeCards.filter(c => c !== cardName);
    setActiveCards(next);
    try { localStorage.setItem('activeCards', JSON.stringify(next)); } catch {}
    setCardMenuOpen(null);
    if (authToken) {
      fetch(`${API}/subscription`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ metricId }),
      }).catch(() => {});
    }
  }

  /**
   * resolveMetricGoalDisplay — determine which goal (if any) to show for a metric.
   *
   * Returns one of:
   *   { mode: 'none' }
   *   { mode: 'standalone',     goal, prog }
   *   { mode: 'single-program', goal, prog, programName }
   *   { mode: 'multi-program',  programNames: string[] }
   */
  function resolveMetricGoalDisplay(metricId) {
    const metricGoals = goals.filter(g => g.metricId === metricId && g.isActive);
    if (!metricGoals.length) return { mode: 'none' };

    // Build goalId → programName[] from active enrollments
    const goalProgramNames = {};
    for (const enr of enrollments) {
      if (!enr.isActive) continue;
      for (const gid of (enr.enrolledGoalIds ?? [])) {
        if (!goalProgramNames[gid]) goalProgramNames[gid] = [];
        goalProgramNames[gid].push(enr.programName);
      }
    }

    const standaloneGoals = metricGoals.filter(g => !goalProgramNames[g.goalId]?.length);
    if (standaloneGoals.length > 0) {
      const goal = standaloneGoals[0];
      return { mode: 'standalone', goal, prog: goalProgress[goal.goalId] ?? null };
    }

    const allProgramNames = [...new Set(
      metricGoals.flatMap(g => goalProgramNames[g.goalId] ?? [])
    )];

    if (allProgramNames.length === 1) {
      const goal = metricGoals[0];
      return { mode: 'single-program', goal, prog: goalProgress[goal.goalId] ?? null, programName: allProgramNames[0] };
    }

    return { mode: 'multi-program', programNames: allProgramNames };
  }

  function openGoalWizard(metricId, specificGoalId) {
    const metricTitle = metricConfig[metricId]?.title || toSentenceCase(metricId);
    const templates = METRIC_GOAL_TEMPLATES[metricId] ?? [];
    const existingGoal = specificGoalId
      ? goals.find(g => g.goalId === specificGoalId)
      : goals.find(g => g.metricId === metricId && g.isActive);
    const todayIso = new Date().toISOString().split('T')[0];
    if (existingGoal) {
      setOpen({
        type: 'goal-wizard',
        metricId,
        metricTitle,
        screen: 'configure',
        template: null,
        draft: { ...existingGoal },
        editGoalId: existingGoal.goalId,
      });
    } else {
      setOpen({
        type: 'goal-wizard',
        metricId,
        metricTitle,
        screen: 'wizard',
        wizStep: 'category',
        wiz: {},
        draft: { ...GOAL_DEFAULTS, metricId, name: '', startDate: todayIso },
        editGoalId: undefined,
      });
    }
    setCardMenuOpen(null);
  }

  async function handleSaveGoal() {
    const draft = open?.draft;
    if (!draft?.name?.trim()) {
      setOpen({ ...open, saveError: 'Please enter a goal name.' });
      return;
    }
    if (draft.goalType === 'range') {
      if (draft.targetMin == null || draft.targetMax == null) {
        setOpen({ ...open, saveError: 'Please enter both Min and Max values.' });
        return;
      }
    } else if (draft.goalType === 'streak') {
      if (!draft.streakTarget) {
        setOpen({ ...open, saveError: 'Please enter a streak target (days).' });
        return;
      }
    } else {
      if (draft.targetValue == null) {
        setOpen({ ...open, saveError: 'Please enter a target value.' });
        return;
      }
    }
    setOpen({ ...open, isSaving: true, saveError: undefined });
    try {
      const body = { ...draft };
      if (open.editGoalId) body.goalId = open.editGoalId;
      const res = await fetch(`${API}/goal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setOpen({ ...open, isSaving: false, saveError: err.error || 'Save failed. Please try again.' });
        return;
      }
      const { goal } = await res.json();
      setGoals(prev => [...prev.filter(g => g.goalId !== goal.goalId), goal]);
      fetchGoalProgress(authToken, [goal]);
      setOpen(null);
    } catch {
      setOpen({ ...open, isSaving: false, saveError: 'Network error. Please try again.' });
    }
  }

  async function handleDeleteGoal(goalId) {
    if (!window.confirm('Delete this goal?')) return;
    try {
      const res = await fetch(`${API}/goal`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ goalId }),
      });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.goalId !== goalId));
        setGoalProgress(prev => { const n = { ...prev }; delete n[goalId]; return n; });
      }
    } catch {}
  }

  // ── Program wizard ─────────────────────────────────────────────────────────

  function openProgramWizard(existingProgram) {
    if (existingProgram) {
      // Enrich stored items with goal config from the current enrollment/goals,
      // because program-save only persists metricId/itemId/notes — not the goal blueprint.
      const enrollment = enrollments.find(e => e.programId === existingProgram.programId && e.isActive);
      const enrichedItems = (existingProgram.items ?? []).map(item => {
        const enrolledGoal = enrollment
          ? goals.find(g => enrollment.enrolledGoalIds?.includes(g.goalId) && g.metricId === item.metricId)
          : null;
        if (!enrolledGoal) return item;
        return {
          ...item,
          _enrolledGoalId: enrolledGoal.goalId,
          goalName:        enrolledGoal.name,
          goalType:        enrolledGoal.goalType,
          period:          enrolledGoal.period,
          periodDays:      enrolledGoal.periodDays,
          direction:       enrolledGoal.direction,
          aggregation:     enrolledGoal.aggregation,
          targetValue:     enrolledGoal.targetValue,
          startingValue:   enrolledGoal.startingValue,
          targetMin:       enrolledGoal.targetMin,
          targetMax:       enrolledGoal.targetMax,
          streakTarget:    enrolledGoal.streakTarget,
        };
      });
      setOpen({ type: 'program-wizard', screen: 'name', programId: existingProgram.programId, draft: { ...existingProgram, items: enrichedItems } });
    } else {
      setOpen({ type: 'program-wizard', screen: 'name', programId: null, draft: { name: '', description: '', items: [] } });
    }
  }

  async function handleSaveProgram() {
    const draft = open?.draft;
    if (!draft?.name?.trim()) {
      setOpen({ ...open, saveError: 'Please enter a program name.' });
      return;
    }
    if (!draft.items?.length) {
      setOpen({ ...open, saveError: 'Add at least one metric goal before saving.' });
      return;
    }
    setOpen({ ...open, isSaving: true, saveError: undefined });
    try {
      const userId = user?.userId ?? user?.sub ?? '';
      const progId = open.programId || `prog-${Date.now().toString(36)}`;
      const programPayload = {
        ...draft,
        programId:   progId,
        programType: 'personal',
        createdBy:   userId,
      };

      // 1 — Save the program definition
      const progRes = await fetch(`${API}/program`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(programPayload),
      });
      if (!progRes.ok) {
        const err = await progRes.json().catch(() => ({}));
        setOpen({ ...open, isSaving: false, saveError: err.error || 'Failed to save program.' });
        return;
      }
      const { program: savedProgram } = await progRes.json();

      // 2 — Create a live goal for each item and collect goalIds
      const todayIso = new Date().toISOString().split('T')[0];
      const enrolledGoalIds = [];
      for (const item of draft.items) {
        const goalBody = {
          ...(item._enrolledGoalId ? { goalId: item._enrolledGoalId } : {}),
          metricId:     item.metricId,
          name:         item.goalName || item.metricId,
          goalType:     item.goalType,
          period:       item.period,
          direction:    item.direction,
          aggregation:  item.aggregation ?? 'avg',
          targetValue:  item.targetValue ?? null,
          startingValue: item.startingValue ?? null,
          targetMin:    item.targetMin ?? null,
          targetMax:    item.targetMax ?? null,
          streakTarget: item.streakTarget ?? null,
          periodDays:   item.periodDays ?? null,
          startDate:    todayIso,
          isActive:     true,
        };
        const gRes = await fetch(`${API}/goal`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(goalBody),
        });
        if (gRes.ok) {
          const { goal } = await gRes.json();
          setGoals(prev => [...prev.filter(g => g.goalId !== goal.goalId), goal]);
          fetchGoalProgress(authToken, [goal]);
          enrolledGoalIds.push(goal.goalId);
        }
      }

      // 3 — Auto-enroll (personal program; creator is always enrolled)
      await fetch(`${API}/program/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ programId: progId, enrolledGoalIds, isCustomized: false }),
      });

      setPrograms(prev => [...prev.filter(p => p.programId !== progId), savedProgram ?? programPayload]);
      fetchAndApplyEnrollments(authToken);
      setOpen(null);
    } catch {
      setOpen({ ...open, isSaving: false, saveError: 'Network error. Please try again.' });
    }
  }

  async function handleDeleteProgram(programId) {
    if (!window.confirm('Delete this program? Associated goals will remain but will no longer be linked to the program.')) return;
    try {
      const res = await fetch(`${API}/program`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ programId }),
      });
      if (res.ok) {
        setPrograms(prev => prev.filter(p => p.programId !== programId));
      }
    } catch {}
  }

  // --- Feature flags (persisted) --------------------------------------------
  // --- View mode ------------------------------------------------------------
  // 'day' = show all cards for selected date
  // 'metric-history' = show all entries for a specific metric across dates
  // 'latest' = show all cards with their most recent data regardless of date
  const [viewMode, setViewMode] = useState('day');
  const [goals, setGoals] = useState([]);
  const [goalProgress, setGoalProgress] = useState({});
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const defaultHistoryMetric = 'weight';
  const [historyMetric, setHistoryMetric] = useState(defaultHistoryMetric);
  const [prevViewMode, setPrevViewMode] = useState('day');

  // date navigation helpers
  function prevDay() {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  }
  function nextDay() {
    // Prevent advancing into future dates
    const todayKey = toKey(today);
    const selKey = toKey(selectedDate);
    if (selKey === todayKey) return; // already at today
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    // clamp to today
    const newKey = toKey(d);
    if (newKey > todayKey) {
      setSelectedDate(new Date(today));
    } else {
      setSelectedDate(d);
    }
  }

  const niceDate = selectedDate.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Current date/time label (for left header area) — updates every minute
  const formatNowText = () => new Date().toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const [nowText, setNowText] = useState(formatNowText);
  useEffect(() => {
    const id = setInterval(() => setNowText(formatNowText()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);


  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  };

  // Simple swipe gesture handlers to navigate days on touch devices
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e) => {
    if (open) return; // don't navigate while a dialog is open
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e) => {
    if (open) return;
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    const threshold = 40; // px
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) nextDay(); // swipe left
      else prevDay(); // swipe right
    }
  };

  function handleSaveCustomMetric() {
    const def = open?.tempDef ?? {};
    const name = toTitleCase((def.friendly_name ?? '').trim());
    if (!name) { setOpen({ ...open, tempDefError: 'Friendly name is required.' }); return; }
    const id = slugify(name) || `custom-${Date.now()}`;
    if (metricConfig[id]) { setOpen({ ...open, tempDefError: `A metric named "${name}" already exists.` }); return; }
    const kind = def.value_type === 'boolean' ? 'switch'
               : (def.value_type === 'numeric' && def.slider_enabled) ? 'slider'
               : def.value_type === 'string' ? 'text'
               : 'singleValue';
    const newConfigEntry = {
      title: name, kind, uom: def.uom ?? '', _icon: def.icon || 'Activity',
      ...(def.info_url ? { infoUrl: def.info_url } : {}),
      ...(kind === 'slider' ? { logicalMin: def.logical_min ?? 0, logicalMax: def.logical_max ?? 10 } : {}),
      ...(def.value_type === 'boolean' ? { falseTag: def.false_tag || 'No', trueTag: def.true_tag || 'Yes' } : {}),
      trackingFlavor: def.tracking_flavor ?? null,
    };
    const newCardEntry = { cardName: id, title: name, icon: METRIC_ICONS[def.icon] ?? Activity, metricNames: [id] };
    setMetricConfig(prev => ({ ...prev, [id]: newConfigEntry }));
    setCardDefinitions(prev => [...prev, newCardEntry]);
    const nextActive = [...activeCards, id];
    setActiveCards(nextActive);
    try {
      const customs = JSON.parse(localStorage.getItem('customMetrics') || '{}');
      customs[id] = newConfigEntry;
      localStorage.setItem('customMetrics', JSON.stringify(customs));
      localStorage.setItem('activeCards', JSON.stringify(nextActive));
    } catch {}
    if (authToken) {
      fetch(`${API}/metric`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          metricId: id, friendlyName: name, icon: def.icon || 'Activity',
          infoUrl: def.info_url || '', valueType: def.value_type,
          sliderEnabled: !!def.slider_enabled, logicalMin: def.logical_min ?? 0,
          logicalMax: def.logical_max ?? 10, uom: def.uom || '',
          falseTag: def.false_tag || 'No', trueTag: def.true_tag || 'Yes',
          trackingFlavor: def.tracking_flavor ?? null,
        }),
      })
      .then(() =>
        // Subscribe the user to their newly created metric
        fetch(`${API}/subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ metricId: id }),
        })
      )
      .catch(() => {});
    }
    // If launched from the program wizard, return to it (metric is now available to pick)
    const returnTo = open?._returnTo;
    if (returnTo) {
      setOpen({ ...returnTo, screen: 'pick-metric', saveError: undefined });
    } else {
      setOpen(null);
    }
  }

  if (!authToken) {
    return <LoginScreen onAuth={handleAuth} />;
  }

  if (profileReady === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16, color: "#1530E8" }}>
        <div className="login-spinner" style={{ width: 36, height: 36, borderWidth: 3, borderColor: "rgba(21,48,232,0.2)", borderTopColor: "#1530E8" }} />
        <div style={{ fontSize: 15, color: "#6b7280" }}>Loading your profile…</div>
      </div>
    );
  }

  if (profileReady === "setup") {
    return (
      <ProfileSetup
        username={authUsername}
        onSave={async (profileData) => {
          await saveProfileToBackend(authToken, profileData);
          setUser(prev => {
            const merged = { ...prev, ...profileData, services: prev.services ?? [] };
            try { localStorage.setItem("user", JSON.stringify(merged)); } catch { }
            return merged;
          });
          setProfileReady("ready");
        }}
      />
    );
  }

  return (
    <div style={{ padding: 24 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Settings menu popup — rendered at top level so it works from any section */}
      {showSettingsMenu && (
        <>
          <div
            className="calendar-popup-overlay"
            onClick={() => setShowSettingsMenu(false)}
          />
          <div className="settings-menu-popup">
            <div className="settings-menu-header">Settings</div>
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "profile", tempUser: (() => {
                  const u = { ...user };
                  if (u.heightInches) {
                    u.heightFt = Math.floor(u.heightInches / 12);
                    u.heightIn = u.heightInches % 12;
                  }
                  return u;
                })() });
              }}
            >
              <User size={18} />
              <span>About Me</span>
            </button>
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "services", tempUser: { ...user } });
              }}
            >
              <Link size={18} />
              <span>Connected Services</span>
            </button>
            <div className="settings-menu-divider" />
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "import" });
              }}
            >
              <Download size={18} />
              <span>Import Data</span>
            </button>
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "export" });
              }}
            >
              <Upload size={18} />
              <span>Export Data</span>
            </button>
            <div className="settings-menu-divider" />
            <button
              className="settings-menu-item"
              style={{ color: "rgba(248,113,113,0.9)" }}
              onClick={() => {
                setShowSettingsMenu(false);
                sessionStorage.removeItem("authToken");
                setAuthToken(null);
              }}
            >
              <LogOut size={18} style={{ color: "rgba(248,113,113,0.7)" }} />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}

      {/* ===== HOME SCREEN ===== */}
      {activeSection === null && (
        <div className="home-wrapper">
          <div className="home-header">
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 2px 0" }}>{getGreeting()}, {user.firstName}!</h1>
              <div className="header-date">{nowText}</div>
            </div>
            <button
              ref={settingsButtonRef}
              className={user.photo ? "home-settings-btn home-settings-btn--avatar" : "btn-icon home-settings-btn"}
              aria-label="Settings menu"
              title="Settings"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            >
              {user.photo ? (
                <>
                  <img src={user.photo} alt="Profile" className="home-settings-avatar-img" />
                  <span className="home-settings-gear"><Settings size={12} /></span>
                </>
              ) : (
                <Settings />
              )}
            </button>
          </div>
          <div className="home-grid">
            <div className="home-panel home-panel--data" onClick={() => setActiveSection('my-data')}>
              <div>
                <div className="home-panel-icon-wrap"><NestedRingsLogo size={52} highlight="data" strokeColor="white" fillColor="white" strokeOpacity={0.8} /></div>
                <div className="home-panel-title">My Data</div>
                <div className="home-panel-desc">Track your vitals, medications, and daily health metrics. Log readings and view trends over time.</div>
              </div>
              <div className="home-panel-cta">Open →</div>
            </div>
            <div className="home-panel home-panel--programs" onClick={() => setActiveSection('my-programs')}>
              <div>
                <div className="home-panel-icon-wrap"><NestedRingsLogo size={48} highlight="programs" strokeColor="rgba(26,46,5,0.55)" fillColor="#4d7c0f" strokeOpacity={0.7} /></div>
                <div className="home-panel-title">My Journey</div>
                <div className="home-panel-desc">Follow personalized health plans and structured wellness routines.</div>
              </div>
              <div className="home-panel-cta">Open →</div>
            </div>
            <div className="home-panel home-panel--circles" onClick={() => setActiveSection('my-circles')}>
              <div>
                <div className="home-panel-icon-wrap"><NestedRingsLogo size={48} highlight="circles" strokeColor="rgba(5,25,50,0.45)" fillColor="#1d4ed8" strokeOpacity={0.7} /></div>
                <div className="home-panel-title">My Circles</div>
                <div className="home-panel-desc">Connect with your care team, family, and support network.</div>
              </div>
              <div className="home-panel-badge">Coming Soon</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MY JOURNEY ===== */}
      {activeSection === 'my-programs' && (
        <div className="mydata-wrapper">
          {/* Hero banner */}
          <div className="myprogs-hero">
            <NestedRingsLogo size={180} highlight="programs" strokeColor="white" fillColor="white" strokeOpacity={0.65} style={{ position: 'absolute', top: -10, right: -15, pointerEvents: 'none', opacity: 0.2 }} />
            <div className="mydata-hero-left">
              <button className="home-back-btn home-back-btn--light" onClick={() => setActiveSection(null)}>
                <Home size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Home
              </button>
              <div className="mydata-hero-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <NestedRingsLogo size={28} highlight="programs" strokeColor="white" fillColor="white" strokeOpacity={0.8} />
                My Journey
              </div>
              <div className="mydata-hero-sub">{getGreeting()}, {user.firstName} &middot; {nowText}</div>
            </div>
            <div className="myprogs-hero-actions">
              <Button variant="outline" className="btn-icon" aria-label="New Program" title="New Program" onClick={() => openProgramWizard(null)}>
                <Plus />
              </Button>
              <Button variant="outline" className="btn-icon" aria-label="My Data" title="My Data" onClick={() => setActiveSection('my-data')}>
                <NestedRingsLogo size={18} highlight="data" strokeColor="currentColor" fillColor="currentColor" strokeOpacity={0.85} />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 0 80px' }}>
            {programs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', background: '#f9fafb', borderRadius: 12, border: '1px dashed #d1d5db', marginTop: 8 }}>
                <NestedRingsLogo size={80} highlight="programs" strokeColor="#9ca3af" fillColor="#d9f99d" strokeOpacity={0.6} className="logo-pulse" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 6 }}>No programs yet</div>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>Create a personal program to bundle metrics and goals into a structured plan.</div>
                <Button onClick={() => openProgramWizard(null)}>
                  <Plus size={14} style={{ marginRight: 6 }} />Create Your First Program
                </Button>
              </div>
            ) : (
              <div className="myprogs-cards-grid">
                {programs.map((prog, progIdx) => {
                  const enrollment = enrollments.find(e => e.programId === prog.programId && e.isActive);
                  const itemCount = prog.items?.length ?? 0;
                  return (
                    <div key={prog.programId} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', animation: 'card-pop-in 0.38s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${progIdx * 0.07}s` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{prog.name}</span>
                            {enrollment && <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '1px 8px', borderRadius: 10 }}>Active</span>}
                          </div>
                          {prog.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{prog.description}</div>}
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{itemCount} metric goal{itemCount !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginLeft: 10, flexShrink: 0 }}>
                          <Button variant="ghost" style={{ padding: '4px 8px', height: 'auto', fontSize: 12 }} onClick={() => openProgramWizard(prog)}>Edit</Button>
                          <Button variant="ghost" style={{ padding: '4px 8px', height: 'auto', fontSize: 12, color: '#ef4444' }} onClick={() => handleDeleteProgram(prog.programId)}>Delete</Button>
                        </div>
                      </div>
                      {prog.items?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                          {prog.items.map(item => {
                            const cfg = metricConfig[item.metricId] ?? {};
                            const title = cfg.title || toSentenceCase(item.metricId);
                            const Icon = METRIC_ICONS[cfg._icon] ?? Activity;
                            const enrolledGoal = enrollment
                              ? goals.find(g =>
                                  enrollment.enrolledGoalIds?.includes(g.goalId) &&
                                  g.metricId === item.metricId
                                )
                              : null;
                            const prog2 = enrolledGoal ? (goalProgress[enrolledGoal.goalId] ?? null) : null;
                            const pctRaw = prog2?.pct ?? null;
                            const itemUom = cfg.uom ?? '';
                            const fmtVi = v => v != null ? `${v}${itemUom ? '\u2009' + itemUom : ''}` : '—';
                            const isLIBi = (enrolledGoal?.direction ?? item.direction) === 'lower_is_better';
                            const hasEndpoints = item.goalType === 'target_value' && enrolledGoal?.startingValue != null && enrolledGoal?.targetValue != null;

                            // Recompute bar pct from start→target range when applicable
                            let barPctI = pctRaw != null ? pctRaw * 100 : null;
                            if (hasEndpoints && prog2?.current != null) {
                              const range = isLIBi ? (enrolledGoal.startingValue - enrolledGoal.targetValue) : (enrolledGoal.targetValue - enrolledGoal.startingValue);
                              if (range !== 0) {
                                const moved = isLIBi ? (enrolledGoal.startingValue - prog2.current) : (prog2.current - enrolledGoal.startingValue);
                                barPctI = Math.min(100, Math.max(0, (moved / range) * 100));
                              }
                            }

                            const isLBC = item.goalType === 'cumulative' && item.direction === 'lower_is_better';
                            const barColor = prog2
                              ? (item.goalType === 'range'
                                  ? (prog2.isOnTrack ? '#10b981' : '#f59e0b')
                                  : isLBC
                                    ? (barPctI <= 60 ? '#10b981' : barPctI <= 85 ? '#f59e0b' : '#ef4444')
                                    : hasEndpoints
                                      ? (barPctI >= 100 ? '#10b981' : '#f59e0b')
                                      : (prog2.isOnTrack ? '#10b981' : '#f59e0b'))
                              : '#d1d5db';

                            const progressLabel = prog2
                              ? goalProgressLabel(enrolledGoal?.goalType ?? item.goalType, enrolledGoal?.direction ?? item.direction, prog2, fmtVi)
                              : null;
                            return (
                              <div key={item.itemId}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                                    <Icon size={12} style={{ color: '#6b7280', flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.goalName || title}</span>
                                  </div>
                                </div>
                                {hasEndpoints && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>
                                    <span>{fmtVi(enrolledGoal.startingValue)}</span>
                                    {prog2?.current != null && <span style={{ color: '#374151', fontWeight: 600 }}>{fmtVi(prog2.current)}</span>}
                                    <span>{fmtVi(enrolledGoal.targetValue)}</span>
                                  </div>
                                )}
                                {item.goalType === 'range' && enrolledGoal?.targetMin != null && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>
                                    <span>Range: {fmtVi(enrolledGoal.targetMin)}–{fmtVi(enrolledGoal.targetMax)}</span>
                                    {prog2?.current != null && <span style={{ color: '#374151', fontWeight: 600 }}>{fmtVi(prog2.current)}</span>}
                                  </div>
                                )}
                                <div style={{ height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(100, Math.max(0, barPctI ?? 0))}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                                </div>
                                {progressLabel && (
                                  <div style={{ fontSize: 10, color: barColor, fontWeight: 600, marginTop: 2 }}>{progressLabel}</div>
                                )}
                                {!prog2 && (
                                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{(item.period ?? '').replace(/_/g, ' ')}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== MY CIRCLES placeholder ===== */}
      {activeSection === 'my-circles' && (
        <div className="section-placeholder-wrapper">
          <button className="home-back-btn" onClick={() => setActiveSection(null)}>
            <Home size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Home
          </button>
          <div className="section-placeholder">
            <div className="section-placeholder-icon" style={{ background: 'linear-gradient(145deg, #0284c7, #2563eb)' }}>
              <Users size={40} strokeWidth={1.5} color="white" />
            </div>
            <h2 className="section-placeholder-title">My Circles</h2>
            <p className="section-placeholder-desc">Connect with your care team, family, and support network — coming soon.</p>
            <span className="section-placeholder-badge">Coming Soon</span>
          </div>
        </div>
      )}

      {/* ===== MY DATA section ===== */}
      {activeSection === 'my-data' && (
        <div className="mydata-wrapper">
          {/* Hero banner */}
          <div className="mydata-hero">
            <NestedRingsLogo size={180} highlight="data" strokeColor="white" fillColor="white" strokeOpacity={0.65} style={{ position: 'absolute', top: -10, right: -15, pointerEvents: 'none', opacity: 0.2 }} />
            <div className="mydata-hero-left">
              <button className="home-back-btn home-back-btn--light" onClick={() => setActiveSection(null)}>
                <Home size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Home
              </button>
              <div className="mydata-hero-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <NestedRingsLogo size={28} highlight="data" strokeColor="white" fillColor="white" strokeOpacity={0.8} />
                My Data
              </div>
              <div className="mydata-hero-sub">{getGreeting()}, {user.firstName} &middot; {nowText}</div>
            </div>
            {/* Action toolbar */}
            <div className="mydata-hero-actions">
          {/* icon-only date picker (restored to header right) */}
          <Button
            variant="outline"
            className={`btn-icon btn-mode ${viewMode === 'day' ? 'btn-mode-active' : ''}`}
            aria-label="Day view"
            title="Day view"
            onClick={() => setViewMode('day')}
          >
            <CalendarDays />
          </Button>
          {/* date pill shown in day mode */}
          {viewMode === 'day' && (
            <button
              ref={calendarButtonRef}
              className="date-pill"
              aria-label="Change date"
              onClick={() => setShowCalendarPopup(!showCalendarPopup)}
            >
              {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </button>
          )}
          {/* current/today view */}
          <Button
            variant="outline"
            className={`btn-icon btn-mode ${viewMode === 'current' ? 'btn-mode-active' : ''}`}
            aria-label="Today"
            title="Today"
            onClick={() => setViewMode('current')}
          >
            <Sun />
          </Button>
          {/* goals view */}
          <Button
            variant="outline"
            className={`btn-icon btn-mode ${viewMode === 'goals' ? 'btn-mode-active' : ''}`}
            aria-label="Goals"
            title="My Goals"
            onClick={() => setViewMode('goals')}
          >
            <Flag />
          </Button>
          {/* add metric */}
          <Button
            variant="outline"
            className="btn-icon"
            aria-label="Add metric to dashboard"
            title="Add a metric"
            style={{ marginLeft: 8 }}
            onClick={async () => {
              const tempDef = { value_type: 'numeric', slider_enabled: false, logical_min: 0, logical_max: 10,
                icon: 'Activity', false_tag: 'No', true_tag: 'Yes', uom: '', friendly_name: '', info_url: '' };
              setOpen({ type: 'add-metric', screen: 'catalog', catalog: null, tempDef });
              try {
                const res = await fetch(`${API}/metrics/catalog`, {
                  headers: { Authorization: `Bearer ${authToken}` },
                });
                if (res.ok) {
                  const { metrics } = await res.json();
                  setOpen(prev => prev?.type === 'add-metric' ? { ...prev, catalog: metrics ?? [] } : prev);
                }
              } catch {}
            }}
          >
            <Plus />
          </Button>
          {/* Jump to My Journey */}
          <Button
            variant="outline"
            className="btn-icon"
            aria-label="My Journey"
            title="My Journey"
            style={{ marginLeft: 4 }}
            onClick={() => setActiveSection('my-programs')}
          >
            <NestedRingsLogo size={18} highlight="programs" strokeColor="currentColor" fillColor="currentColor" strokeOpacity={0.85} />
          </Button>
              {/* swipe left/right on the screen to change dates */}
            </div>
          </div>

      {/* Calendar popup */}
      {showCalendarPopup && viewMode === 'day' && (
        <>
          <div
            className="calendar-popup-overlay"
            onClick={() => setShowCalendarPopup(false)}
          />
          <div className="calendar-popup">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  setSelectedDate(d);
                  setShowCalendarPopup(false);
                }
              }}
              disabled={(date) => date > today}
              initialFocus
            />
          </div>
        </>
      )}

      {/* View label */}
      <div className="mydata-view-label">
        {viewMode === 'day' && <span>Data for {niceDate}</span>}
        {viewMode === 'metric-history' && <span>History: {metricConfig[historyMetric]?.title || toSentenceCase(historyMetric)}</span>}
        {viewMode === 'current' && <span>Today</span>}
        {viewMode === 'goals' && <span>My Goals</span>}
      </div>

      {/* Main content */}
      {viewMode === 'goals' ? (
        /* ── Goals panel ── */
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 80px' }}>
          {goals.filter(g => g.isActive).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <Flag size={48} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#374151' }}>No goals yet</div>
              <div style={{ fontSize: 14 }}>Tap ··· on any metric card to set a goal.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {goals.filter(g => g.isActive).map(goal => {
                const prog = goalProgress[goal.goalId];
                const metricTitle = metricConfig[goal.metricId]?.title || toSentenceCase(goal.metricId);
                const pct = prog?.pct ?? null;
                const isOnTrack = prog?.isOnTrack ?? null;
                const uom = metricConfig[goal.metricId]?.uom ?? '';
                const fmtV = v => v != null ? `${v}${uom ? '\u2009' + uom : ''}` : '—';
                const barColor = isOnTrack === true ? '#10b981' : pct != null && pct >= 60 ? '#f59e0b' : '#ef4444';
                const PERIOD_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', rolling: 'Rolling', all_time: 'All Time' };
                const TYPE_LABELS = { target_value: 'Target', cumulative: 'Cumulative', range: 'Range', streak: 'Streak', best_of: 'Personal Best' };
                return (
                  <div key={goal.goalId} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 10, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{goal.name}</div>
                        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                          {metricTitle} · {TYPE_LABELS[goal.goalType] ?? goal.goalType} · {PERIOD_LABELS[goal.period] ?? goal.period}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <Button variant="ghost" style={{ padding: '4px 8px', height: 'auto' }} onClick={() => openGoalWizard(goal.metricId, goal.goalId)}>
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" style={{ padding: '4px 8px', height: 'auto', color: '#ef4444' }} onClick={() => handleDeleteGoal(goal.goalId)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                    {pct !== null ? (
                      (() => {
                        const hasEndpoints = goal.goalType === 'target_value' && goal.startingValue != null && goal.targetValue != null;
                        const isLIB = goal.direction === 'lower_is_better';
                        const current = prog?.current ?? null;

                        // Recompute pct from start→target range when startingValue is available
                        let displayPct = pct;
                        if (hasEndpoints && current !== null) {
                          const range = isLIB
                            ? (goal.startingValue - goal.targetValue)
                            : (goal.targetValue - goal.startingValue);
                          if (range !== 0) {
                            const moved = isLIB
                              ? (goal.startingValue - current)
                              : (current - goal.startingValue);
                            displayPct = Math.min(100, Math.max(0, (moved / range) * 100));
                          }
                        }

                        // Amber while in-progress, green when done — no red for target goals
                        const displayColor = displayPct >= 100 ? '#10b981' : '#f59e0b';

                        return hasEndpoints ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 4 }}>
                              <span style={{ color: '#9ca3af' }}>Start: <span style={{ color: '#6b7280', fontWeight: 500 }}>{fmtV(goal.startingValue)}</span></span>
                              {current != null && <span style={{ color: '#374151', fontWeight: 600, fontSize: 12 }}>{fmtV(current)}</span>}
                              <span style={{ color: '#9ca3af' }}>Goal: <span style={{ color: '#6b7280', fontWeight: 500 }}>{fmtV(goal.targetValue)}</span></span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${displayPct}%`, height: '100%', background: displayColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 11, marginTop: 3 }}>
                              <span style={{ fontWeight: 600, color: displayColor }}>
                                {isOnTrack === true && <CheckCircle2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}
                                {current != null
                                  ? displayPct >= 100
                                    ? `Goal reached!`
                                    : `${fmtV(Math.abs(+current - goal.targetValue))} to go`
                                  : `${Math.round(displayPct)}%`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                              <span style={{ color: '#6b7280' }}>{prog?.periodLabel ?? ''}</span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                            </div>
                            {(() => {
                              const label = goalProgressLabel(goal.goalType, goal.direction, prog, fmtV);
                              return label ? (
                                <div style={{ textAlign: 'right', fontSize: 11, marginTop: 3 }}>
                                  <span style={{ fontWeight: 600, color: barColor }}>
                                    {isOnTrack === true && <CheckCircle2 size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}
                                    {label}
                                  </span>
                                </div>
                              ) : null;
                            })()}
                          </>
                        );
                      })()
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>No progress data yet</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode !== 'metric-history' ? (
        <div className="mydata-cards-grid">
          {(() => {
            const points = records.dataPoints ?? {};
            // Render only active cards, in the chosen order
            return activeCards
              .map((name) => cardDefinitions.find((c) => c.cardName === name))
              .filter(Boolean)
              .map((meta, cardIdx) => {
                // Gather values for all metrics in this card
                const metricValues = meta.metricNames.map(metricName => {
                  const config = metricConfig[metricName];
                  const data = points[metricName] ?? {};
                  const fallbackValue = records[selectedKey]?.[metricName] ?? null;
                  const fallbackUpdated = records[selectedKey]?.[`${metricName}UpdatedAt`] ?? null;
                  // Determine the relevant entry based on view mode
                  const entries = Array.isArray(data.entries) ? data.entries : [];
                  let lastEntry = null;
                  let entryCount = 0;
                  if (viewMode === 'day') {
                    const dayStart = new Date(selectedDate);
                    dayStart.setHours(0, 0, 0, 0);
                    const startMs = dayStart.getTime();
                    const endMs = startMs + 24 * 60 * 60 * 1000;
                    for (let i = entries.length - 1; i >= 0; i--) {
                      const e = entries[i];
                      if (e.ts >= startMs && e.ts < endMs) {
                        if (!lastEntry) lastEntry = e;
                        entryCount++;
                      }
                    }
                    // Fallback to legacy dayValue by scanning timestamp-based keys (and date-only keys)
                    let dvValue = null;
                    let dvUpdated = null;
                    if (!lastEntry && data.dayValue) {
                      const keys = Object.keys(data.dayValue);
                      // Scan keys newest-first if possible by sorting
                      keys.sort((a, b) => {
                        const pa = Date.parse(a) || Number(a) || 0;
                        const pb = Date.parse(b) || Number(b) || 0;
                        return pa - pb;
                      });
                      for (let i = keys.length - 1; i >= 0; i--) {
                        const k = keys[i];
                        let tsK = Number(k);
                        if (!Number.isFinite(tsK)) {
                          const parsed = Date.parse(k.length === 10 ? `${k}T00:00:00` : k);
                          tsK = Number.isFinite(parsed) ? parsed : 0;
                        }
                        if (tsK >= startMs && tsK < endMs) {
                          const rec = data.dayValue[k];
                          dvValue = rec?.value ?? null;
                          dvUpdated = rec?.updatedAt ?? null;
                          lastEntry = tsK ? { ts: tsK, value: dvValue, updatedAt: dvUpdated, source: rec?.source } : null;
                          break;
                        }
                      }
                    }
                  } else if (viewMode === 'current') {
                    // current/today mode: show only today's entries
                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);
                    const startMs = todayStart.getTime();
                    const endMs = startMs + 24 * 60 * 60 * 1000;
                    for (let i = entries.length - 1; i >= 0; i--) {
                      const e = entries[i];
                      if (e.ts >= startMs && e.ts < endMs) {
                        if (!lastEntry) lastEntry = e;
                        entryCount++;
                      }
                    }
                  }
                  const value = lastEntry ? lastEntry.value : (viewMode === 'day' || viewMode === 'current' ? fallbackValue : null);
                  const timestamp = lastEntry ? lastEntry.ts : null;
                  const source = lastEntry ? lastEntry.source : null;
                  const updatedAt = lastEntry ? (lastEntry.updatedAt ?? new Date().toISOString()) : (viewMode === 'day' || viewMode === 'current' ? fallbackUpdated : null);
                  return { metric: metricName, ...config, value, timestamp, source, updatedAt, entryCount };
                });
                const hasValue = metricValues.some(mv => mv.value !== null && mv.value !== undefined);
                const Icon = meta.icon ?? Activity;
                const color = meta.color ?? (meta.metricNames.some(name => metricConfig[name].kind === "slider") ? "#4f46e5" : "#1530E8");

                // Use the first timestamp for display; count total entries for badge
                const displayTimestamp = metricValues.find(v => v.timestamp)?.timestamp;
                const totalEntries = metricValues.reduce((sum, mv) => sum + (mv.entryCount || 0), 0);

                // Collect unique sources (excluding "manual entry")
                const sources = [...new Set(metricValues.map(mv => mv.source).filter(s => s && s !== "manual entry"))];

                return (
                  <div key={meta.cardName} className="mydata-card-wrapper">
                  <Card className="mydata-card" style={{ animationDelay: `${cardIdx * 0.06}s` }}>
                    <CardContent>
                      <div
                        onClick={() => {
                          const toIsoDate = (d) => {
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            return `${yyyy}-${mm}-${dd}`;
                          };
                          const now = new Date();
                          const isToday = toKey(selectedDate) === toKey(new Date());

                          // If today already has a value, tap goes to history
                          if (hasValue && isToday) {
                            setPrevViewMode(viewMode);
                            setHistoryMetric(meta.cardName);
                            setViewMode('metric-history');
                            return;
                          }

                          const defaultTime = isToday
                            ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                            : '09:00';
                          // Default dialog state
                          const baseOpen = {
                            type: meta.cardName,
                            ...meta,
                            metricValues,
                            tempEntryDate: toIsoDate(selectedDate),
                            tempEntryTime: defaultTime,
                          };
                          // Special handling for single-metric cards when exactly one entry exists on this day
                          if ((meta.metricNames?.length ?? 0) === 1) {
                            const metricName = meta.metricNames[0];
                            const data = (records.dataPoints ?? {})[metricName] ?? {};
                            const entries = Array.isArray(data.entries) ? data.entries : [];
                            const dayStart = new Date(selectedDate);
                            dayStart.setHours(0, 0, 0, 0);
                            const startMs = dayStart.getTime();
                            const endMs = startMs + 24 * 60 * 60 * 1000;
                            const dayEntries = entries.filter(e => e.ts >= startMs && e.ts < endMs);
                            if (dayEntries.length === 1) {
                              // ONE entry: prefill for editing
                              const e = dayEntries[0];
                              const dt = new Date(e.ts);
                              const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                              const mv = [{ ...metricValues[0], value: e.value }];
                              setOpen({
                                ...baseOpen,
                                metricValues: mv,
                                tempEntryDate: toIsoDate(dt),
                                tempEntryTime: timeStr,
                                editEntryTs: e.ts,
                                entryAction: 'update', // or 'add'
                              });
                              return;
                            } else if (dayEntries.length > 1) {
                              // MULTIPLE entries: show list view
                              setOpen({
                                ...baseOpen,
                                showEntryList: true,
                              });
                              return;
                            }
                          }

                          // Multi-metric card handling
                          if ((meta.metricNames?.length ?? 0) > 1) {
                            const dayStart = new Date(selectedDate);
                            dayStart.setHours(0, 0, 0, 0);
                            const startMs = dayStart.getTime();
                            const endMs = startMs + 24 * 60 * 60 * 1000;

                            // Gather most recent entries for each metric on this day
                            const metricEntries = meta.metricNames.map(metricName => {
                              const data = (records.dataPoints ?? {})[metricName] ?? {};
                              const entries = Array.isArray(data.entries) ? data.entries : [];
                              const dayEntries = entries.filter(e => e.ts >= startMs && e.ts < endMs);
                              const lastEntry = dayEntries.length > 0 ? dayEntries[dayEntries.length - 1] : null;
                              return { metricName, lastEntry };
                            });

                            // Check if all have entries and all share the same timestamp
                            const allHaveEntries = metricEntries.every(me => me.lastEntry !== null);
                            const timestamps = metricEntries.filter(me => me.lastEntry).map(me => me.lastEntry.ts);
                            const allSameTimestamp = timestamps.length > 0 && timestamps.every(ts => ts === timestamps[0]);

                            if (allHaveEntries && allSameTimestamp) {
                              // All metrics have same timestamp: UPDATE mode
                              const sharedTs = timestamps[0];
                              const dt = new Date(sharedTs);
                              const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                              const mv = metricEntries.map((me, idx) => ({
                                ...metricValues[idx],
                                value: me.lastEntry.value
                              }));
                              setOpen({
                                ...baseOpen,
                                metricValues: mv,
                                tempEntryDate: toIsoDate(dt),
                                tempEntryTime: timeStr,
                                editEntryTs: sharedTs,
                                entryAction: 'update',
                                isMultiMetricGrouped: true,
                              });
                              return;
                            } else if (timestamps.length > 0) {
                              // Different timestamps or some missing: show summary and ADD mode
                              setOpen({
                                ...baseOpen,
                                showMultiMetricSummary: true,
                                multiMetricEntries: metricEntries,
                              });
                              return;
                            }
                          }

                          setOpen(baseOpen);
                        }}
                        style={{ cursor: "pointer", textAlign: "center" }}
                      >
                        <div className="icon-row">
                          <Icon style={{ width: 24, height: 24, color: hasValue ? color : "#9ca3af" }} />
                        </div>
                        <h2 className="card-title">{meta.title}</h2>
                        {hasValue ? (
                          <>
                            <div className="card-data" style={{ color }}>
                              {metricValues.map((mv, idx) => {
                                let displayValue;
                                if (mv.kind === "slider") {
                                  displayValue = `${mv.value ?? "—"}`;
                                } else if (mv.kind === "switch") {
                                  displayValue = mv.value === true ? "Yes" : mv.value === false ? "No" : "—";
                                } else {
                                  displayValue = `${mv.value ?? "—"}${mv.uom ? ` ${mv.uom}` : ""}`;
                                }
                                return (
                                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {metricValues.length > 1 ? (
                                      <>
                                        <span style={{ fontSize: "0.75em", fontWeight: "normal", marginRight: 4 }}>
                                          {toSentenceCase(mv.metric)}:{" "}
                                        </span>
                                        {displayValue}
                                      </>
                                    ) : (
                                      displayValue
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <p className="card-updated">
                              {displayTimestamp ? fmtTime(new Date(displayTimestamp)) : "—"}
                              {totalEntries > 1 && (meta.metricNames?.length === 1) && (
                                <span style={{ marginLeft: 8, fontSize: '0.85em', color: '#9ca3af' }}>
                                  ({totalEntries} entries)
                                </span>
                              )}
                            </p>
                            {sources.length > 0 && (
                              <p style={{ fontSize: '0.75em', color: '#9ca3af', marginTop: 2 }}>
                                {sources.join(', ')}
                              </p>
                            )}
                            {(() => {
                              // In 'current' mode, show the last recorded value+date if it was before today
                              if (viewMode !== 'current') return null;
                              const primaryMetric = meta.metricNames?.[0];
                              const allEntries = primaryMetric ? (records.dataPoints?.[primaryMetric]?.entries ?? []) : [];
                              if (!allEntries.length) return null;
                              const lastOverall = allEntries[allEntries.length - 1];
                              const todayKey = toKey(new Date());
                              const lastKey = toKey(new Date(lastOverall.ts));
                              if (lastKey === todayKey) return null; // today's data is already the primary display
                              const cfg = primaryMetric ? metricConfig[primaryMetric] : null;
                              let lastValStr;
                              if (cfg?.kind === 'slider') lastValStr = String(lastOverall.value);
                              else if (cfg?.kind === 'switch') lastValStr = lastOverall.value === true ? 'Yes' : lastOverall.value === false ? 'No' : '—';
                              else lastValStr = `${lastOverall.value ?? '—'}${cfg?.uom ? ` ${cfg.uom}` : ''}`;
                              const lastDate = new Date(lastOverall.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                              return (
                                <p style={{ fontSize: '0.72em', color: '#9ca3af', marginTop: 4 }}>
                                  Last: {lastValStr} on {lastDate}
                                </p>
                              );
                            })()}
                          </>
                        ) : (
                          <p className="card-updated">No data yet</p>
                        )}
                        {(() => {
                          // Streak is a present-tense motivator — only meaningful on today or current view
                          const isCurrentDay = viewMode === 'current' || toKey(selectedDate) === toKey(new Date());
                          if (!isCurrentDay) return null;
                          const primaryMetric = meta.metricNames?.[0];
                          const cfg = primaryMetric ? metricConfig[primaryMetric] : null;
                          const daily  = cfg?.currentDailyStreak  ?? 0;
                          const weekly = cfg?.currentWeeklyStreak ?? 0;
                          if (daily >= 2) {
                            return <p style={{ fontSize: '0.75em', color: '#f59e0b', marginTop: 2, fontWeight: 600 }}>🔥 {daily} day streak</p>;
                          }
                          if (weekly >= 2) {
                            return <p style={{ fontSize: '0.75em', color: '#f59e0b', marginTop: 2, fontWeight: 600 }}>🔥 {weekly} week streak</p>;
                          }
                          return null;
                        })()}
                        {(() => {
                          const display = resolveMetricGoalDisplay(meta.cardName);
                          if (display.mode === 'none') return null;
                          if (display.mode === 'multi-program') {
                            return (
                              <div style={{ marginTop: 6, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
                                Multiple goals ({display.programNames.join(', ')})
                              </div>
                            );
                          }
                          const { goal, prog } = display;
                          if (!prog) return null;
                          const isLBC = goal.goalType === 'cumulative' && goal.direction === 'lower_is_better';
                          const isLIBc = goal.direction === 'lower_is_better';
                          const hasEP = goal.goalType === 'target_value' && goal.startingValue != null && goal.targetValue != null;
                          let pct = (prog.pct ?? 0) * 100;
                          if (hasEP && prog.current != null) {
                            const range = isLIBc ? (goal.startingValue - goal.targetValue) : (goal.targetValue - goal.startingValue);
                            if (range !== 0) {
                              const moved = isLIBc ? (goal.startingValue - prog.current) : (prog.current - goal.startingValue);
                              pct = Math.min(100, Math.max(0, (moved / range) * 100));
                            }
                          }
                          const barColor = isLBC
                            ? (pct <= 60 ? '#10b981' : pct <= 85 ? '#f59e0b' : '#ef4444')
                            : hasEP ? (pct >= 100 ? '#10b981' : '#f59e0b')
                            : (prog.isOnTrack ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444');
                          return (
                            <div style={{ marginTop: 6, width: '80%', margin: '6px auto 0' }}>
                              <div style={{ width: '100%', height: 3, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: barColor, borderRadius: 2 }} />
                              </div>
                              <div style={{ fontSize: 10, color: barColor, fontWeight: 600, marginTop: 2 }}>
                                {(() => {
                                  const lbl = goalProgressLabel(goal.goalType, goal.direction, prog, v => `${v}${metricConfig[meta.cardName]?.uom ? '\u2009' + metricConfig[meta.cardName].uom : ''}`);
                                  return lbl ?? `${Math.round(pct)}%`;
                                })()}
                                {display.mode === 'single-program' && (
                                  <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {display.programName}</span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                  <button
                    className={`card-menu-btn${cardMenuOpen === meta.cardName ? ' open' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardMenuOpen(prev => prev === meta.cardName ? null : meta.cardName);
                    }}
                    aria-label="Card options"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {cardMenuOpen === meta.cardName && (
                    <div className="card-menu-popup">
                      <button
                        className="card-menu-item"
                        onClick={() => {
                          const toIsoDate = (d) => {
                            const yyyy = d.getFullYear();
                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                            const dd = String(d.getDate()).padStart(2, '0');
                            return `${yyyy}-${mm}-${dd}`;
                          };
                          const now = new Date();
                          const isToday = toKey(selectedDate) === toKey(new Date());
                          const defaultTime = isToday
                            ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                            : '09:00';
                          const baseOpen = {
                            type: meta.cardName,
                            ...meta,
                            metricValues,
                            tempEntryDate: toIsoDate(selectedDate),
                            tempEntryTime: defaultTime,
                          };
                          if ((meta.metricNames?.length ?? 0) === 1) {
                            const metricName = meta.metricNames[0];
                            const data = (records.dataPoints ?? {})[metricName] ?? {};
                            const entries = Array.isArray(data.entries) ? data.entries : [];
                            const dayStart = new Date(selectedDate);
                            dayStart.setHours(0, 0, 0, 0);
                            const startMs = dayStart.getTime();
                            const endMs = startMs + 24 * 60 * 60 * 1000;
                            const dayEntries = entries.filter(e => e.ts >= startMs && e.ts < endMs);
                            if (dayEntries.length === 1) {
                              const e = dayEntries[0];
                              const dt = new Date(e.ts);
                              const timeStr = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                              const mv = [{ ...metricValues[0], value: e.value }];
                              setOpen({ ...baseOpen, metricValues: mv, tempEntryDate: toIsoDate(dt), tempEntryTime: timeStr, editEntryTs: e.ts, entryAction: 'update' });
                              setCardMenuOpen(null);
                              return;
                            } else if (dayEntries.length > 1) {
                              setOpen({ ...baseOpen, showEntryList: true });
                              setCardMenuOpen(null);
                              return;
                            }
                          }
                          setOpen(baseOpen);
                          setCardMenuOpen(null);
                        }}
                      >
                        Enter data
                      </button>
                      <button
                        className="card-menu-item"
                        onClick={() => {
                          setPrevViewMode(viewMode);
                          setHistoryMetric(meta.cardName);
                          setViewMode('metric-history');
                          setCardMenuOpen(null);
                        }}
                      >
                        View History
                      </button>
                      <button
                        className="card-menu-item"
                        onClick={() => openGoalWizard(meta.cardName)}
                      >
                        {goals.some(g => g.metricId === meta.cardName && g.isActive) ? 'Edit Goal' : 'Set a Goal'}
                      </button>
                      <button
                        className="card-menu-item"
                        onClick={() => handleDeactivateCard(meta.cardName, meta.cardName)}
                      >
                        Remove from dashboard
                      </button>
                      <button
                        className="card-menu-item danger"
                        onClick={() => handleUnsubscribeCard(meta.cardName, meta.cardName)}
                      >
                        Unsubscribe
                      </button>
                    </div>
                  )}
                  </div>
                );
              });
          })()}
        </div>
      ) : (
        // Metric history view
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px 80px' }}>
          {/* ── Back button ── */}
          <button
            onClick={() => setViewMode(prevViewMode)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', padding: '4px 0 12px', fontWeight: 500 }}
          >
            <ChevronLeft size={15} /> Back
          </button>

          {/* ── Streak strip ── */}
          {(() => {
            const cfg = metricConfig[historyMetric] ?? {};
            const daily = cfg.currentDailyStreak ?? 0;
            const weekly = cfg.currentWeeklyStreak ?? 0;
            if (!daily && !weekly) return null;
            return (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                {daily >= 1 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#b45309' }}>
                    🔥 {daily} day streak
                  </span>
                )}
                {weekly >= 1 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#b45309' }}>
                    🔥 {weekly} week streak
                  </span>
                )}
              </div>
            );
          })()}

          {/* ── Goal summary card(s) ── */}
          {(() => {
            const display = resolveMetricGoalDisplay(historyMetric);
            if (display.mode === 'none') return null;

            if (display.mode === 'multi-program') {
              return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#6b7280' }}>
                  <span style={{ fontWeight: 600, color: '#374151' }}>Multiple goals</span>
                  {' '}({display.programNames.join(', ')}) — open My Journey for details
                </div>
              );
            }

            // Both 'standalone' and 'single-program' render the same detail card
            const { goal, prog, programName } = display;
            if (!prog) return null;
            const cfg2 = metricConfig[historyMetric] ?? {};
            const uom2 = cfg2.uom ?? '';
            const fmtV2 = v => v != null ? `${v}${uom2 ? '\u2009' + uom2 : ''}` : '\u2014';
            const isLBC = goal.goalType === 'cumulative' && goal.direction === 'lower_is_better';
            const isLIB = goal.direction === 'lower_is_better';
            const hasEndpoints = goal.goalType === 'target_value' && goal.startingValue != null && goal.targetValue != null;

            const progressLabel = goalProgressLabel(goal.goalType, goal.direction, prog, fmtV2);

            // Determine bar pct (recompute for target_value with startingValue)
            let barPct = prog.pct != null ? prog.pct * 100 : null;
            if (hasEndpoints && prog.current != null) {
              const range = isLIB ? (goal.startingValue - goal.targetValue) : (goal.targetValue - goal.startingValue);
              if (range !== 0) {
                const moved = isLIB ? (goal.startingValue - prog.current) : (prog.current - goal.startingValue);
                barPct = Math.min(100, Math.max(0, (moved / range) * 100));
              }
            }
            const pctDisplay = barPct != null ? Math.round(barPct) : null;

            // Track label (top-right badge)
            const trackLabelForGoal = () => {
              if (goal.goalType === 'range') {
                if (prog.current == null) return { text: 'No data', color: '#9ca3af' };
                const inR = prog.current >= prog.targetMin && prog.current <= prog.targetMax;
                return inR ? { text: 'In range', color: '#10b981' } : { text: 'Out of range', color: '#f59e0b' };
              }
              if (hasEndpoints) {
                return pctDisplay >= 100 ? { text: 'Goal reached!', color: '#10b981' } : { text: 'In progress', color: '#9ca3af' };
              }
              if (goal.goalType === 'streak') {
                return prog.isOnTrack ? { text: 'On Track', color: '#10b981' } : { text: 'In progress', color: '#9ca3af' };
              }
              return prog.isOnTrack == null ? { text: 'No data', color: '#9ca3af' }
                : prog.isOnTrack ? { text: 'On Track', color: '#10b981' }
                : { text: 'Off Track', color: '#f59e0b' };
            };
            const { text: trackLabel, color: trackColor } = trackLabelForGoal();

            // Bar color
            const barColor = goal.goalType === 'range'
              ? (prog.isOnTrack ? '#10b981' : '#f59e0b')
              : isLBC ? (pctDisplay <= 60 ? '#10b981' : pctDisplay <= 85 ? '#f59e0b' : '#ef4444')
              : hasEndpoints ? (pctDisplay >= 100 ? '#10b981' : '#f59e0b')
              : (prog.isOnTrack ? '#10b981' : pctDisplay >= 60 ? '#f59e0b' : '#ef4444');

            return (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{goal.name}</div>
                    {prog.periodLabel && <div style={{ fontSize: 12, color: '#9ca3af' }}>{prog.periodLabel}</div>}
                    {programName && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{programName}</div>}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: trackColor, whiteSpace: 'nowrap', marginLeft: 8 }}>{trackLabel}</span>
                </div>
                {barPct != null && (
                  <div style={{ marginBottom: 4 }}>
                    {hasEndpoints && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#9ca3af' }}>Start: <span style={{ color: '#6b7280', fontWeight: 500 }}>{fmtV2(goal.startingValue)}</span></span>
                        {prog.current != null && <span style={{ color: '#374151', fontWeight: 600, fontSize: 13 }}>{fmtV2(prog.current)}</span>}
                        <span style={{ color: '#9ca3af' }}>Goal: <span style={{ color: '#6b7280', fontWeight: 500 }}>{fmtV2(goal.targetValue)}</span></span>
                      </div>
                    )}
                    {goal.goalType === 'range' && prog.targetMin != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: '#9ca3af' }}>Range: <span style={{ color: '#6b7280', fontWeight: 500 }}>{fmtV2(prog.targetMin)} – {fmtV2(prog.targetMax)}</span></span>
                        {prog.current != null && <span style={{ color: '#374151', fontWeight: 600 }}>{fmtV2(prog.current)}</span>}
                      </div>
                    )}
                    <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(barPct, 100)}%`, background: barColor, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    {progressLabel && (
                      <div style={{ fontSize: 12, color: barColor, fontWeight: 600, marginTop: 3 }}>{progressLabel}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Entry list ── */}
          {(() => {
            const cfg = metricConfig[historyMetric] || { kind: 'singleValue', uom: '' };
            const dp = (records.dataPoints ?? {})[historyMetric] ?? {};
            const entries = Array.isArray(dp.entries) ? [...dp.entries] : [];
            entries.sort((a, b) => b.ts - a.ts);
            const formatValue = (v) => {
              if (cfg.kind === 'slider') return String(v);
              if (cfg.kind === 'switch') return v === true ? 'Yes' : v === false ? 'No' : '—';
              return `${v ?? '—'}${cfg.uom ? ` ${cfg.uom}` : ''}`;
            };

            if (entries.length === 0) {
              const toIsoDate = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
              };
              const now = new Date();
              const isToday = toKey(selectedDate) === toKey(new Date());
              const defaultTime = isToday
                ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                : '09:00';
              const cfgEmpty = metricConfig[historyMetric] || {};
              const title = cfgEmpty.title || cfgEmpty.prompt || toSentenceCase(historyMetric);
              return (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '16px 0' }}>
                  <div style={{ marginBottom: 10 }}>No data yet</div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen({
                        type: historyMetric,
                        title,
                        metricNames: [historyMetric],
                        metricValues: [{ value: null }],
                        tempEntryDate: toIsoDate(selectedDate),
                        tempEntryTime: defaultTime,
                        editEntryTs: undefined,
                        entryAction: 'add',
                        showMultiMetricSummary: false,
                      });
                    }}
                  >
                    Add new entry
                  </Button>
                </div>
              );
            }
            return (
              <div style={{ display: 'grid', gap: 8 }}>
                {entries.map((e) => {
                  const dt = new Date(e.ts);
                  const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
                  const timeStr = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  return (
                    <div
                      key={e.ts}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', background: '#fff', cursor: 'pointer' }}
                      onClick={() => {
                        const cfgClick = metricConfig[historyMetric] || {};
                        const title = cfgClick.title || cfgClick.prompt || toSentenceCase(historyMetric);
                        const toIsoDate = (d) => {
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          return `${yyyy}-${mm}-${dd}`;
                        };
                        const timeStr24 = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                        setOpen({
                          type: historyMetric,
                          title,
                          metricNames: [historyMetric],
                          metricValues: [{ value: e.value }],
                          tempEntryDate: toIsoDate(dt),
                          tempEntryTime: timeStr24,
                          editEntryTs: e.ts,
                          entryAction: 'update',
                          showMultiMetricSummary: false,
                        });
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{dateStr}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{timeStr}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{formatValue(e.value)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
      </div>
      )}

      {/* Dialogs */}
      <Dialog open={open !== null} onOpenChange={() => setOpen(null)}>
        {/* Date Picker */}
        {open?.type === "date" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a date</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }} data-lpignore="true">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(date) => date > today}
                initialFocus
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
              <Button onClick={() => { setViewMode('day'); setOpen(null); }}>Use this date</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Profile: Edit user information */}
        {open?.type === "profile" && (
          <DialogContent className="profile-dialog-content">
            {/* Gradient hero header with avatar */}
            <div className="profile-hero">
              <div className="profile-avatar-wrap">
                {open?.tempUser?.photo
                  ? <img className="profile-avatar-img" src={open.tempUser.photo} alt="Profile photo" />
                  : (
                    <div className="profile-avatar-initials">
                      {(open?.tempUser?.firstName?.[0] ?? '?').toUpperCase()}{(open?.tempUser?.lastName?.[0] ?? '').toUpperCase()}
                    </div>
                  )
                }
                <button
                  className="profile-avatar-upload-btn"
                  aria-label="Upload photo"
                  onClick={() => document.getElementById('profile-photo-input').click()}
                >
                  <Camera size={16} />
                </button>
                <input
                  id="profile-photo-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // Use a blob URL for instant local preview; the actual S3 upload
                    // happens when the user clicks Save.
                    const previewUrl = URL.createObjectURL(file);
                    setOpen({ ...open, _photoFile: file, tempUser: { ...open.tempUser, photo: previewUrl } });
                  }}
                />
              </div>
              <div className="profile-hero-name">
                {(open?.tempUser?.firstName || open?.tempUser?.lastName)
                  ? `${open?.tempUser?.firstName ?? ''} ${open?.tempUser?.lastName ?? ''}`.trim()
                  : 'My Profile'}
              </div>
              <div className="profile-hero-subtitle">Personal Profile</div>
            </div>

            {/* Form fields */}
            <div className="profile-form-fields">
              <fieldset className="notched-field">
                <legend className="notched-label">First name</legend>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  value={open?.tempUser?.firstName ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, firstName: e.target.value } })}
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent' }}
                />
              </fieldset>
              <fieldset className="notched-field">
                <legend className="notched-label">Last name</legend>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  value={open?.tempUser?.lastName ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, lastName: e.target.value } })}
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent' }}
                />
              </fieldset>
              <fieldset className="notched-field">
                <legend className="notched-label">Date of birth</legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button
                    type="button"
                    variant="outline"
                    className="btn-icon notched-dob-btn"
                    aria-label="Select date of birth"
                    data-lpignore="true"
                    onClick={() => {
                      const el = document.getElementById('dob');
                      if (el) {
                        if (typeof el.showPicker === 'function') {
                          el.showPicker();
                        } else {
                          el.focus();
                        }
                      }
                    }}
                  >
                    <CalendarDays />
                  </Button>
                  <Input
                    id="dob"
                    type="date"
                    autoComplete="off"
                    data-lpignore="true"
                    className="no-native-picker"
                    value={open?.tempUser?.dob ?? ""}
                    onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, dob: e.target.value } })}
                    style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent', flex: 1 }}
                  />
                </div>
              </fieldset>
              {/* Height — stored in inches, displayed as ft + in */}
              <fieldset className="notched-field">
                <legend className="notched-label">Height</legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input
                    type="number" min="1" max="8"
                    autoComplete="off" data-lpignore="true"
                    value={open?.tempUser?.heightFt ?? ""}
                    onChange={(e) => {
                      const ft = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                      const inches = (ft === "" ? null : ft * 12 + (parseInt(open?.tempUser?.heightIn ?? 0, 10) || 0));
                      setOpen({ ...open, tempUser: { ...open.tempUser, heightFt: ft, heightInches: inches } });
                    }}
                    placeholder="ft"
                    style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent', width: 48 }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>ft</span>
                  <Input
                    type="number" min="0" max="11"
                    autoComplete="off" data-lpignore="true"
                    value={open?.tempUser?.heightIn ?? ""}
                    onChange={(e) => {
                      const inches = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                      const total = ((parseInt(open?.tempUser?.heightFt ?? 0, 10) || 0) * 12) + (inches === "" ? 0 : inches);
                      setOpen({ ...open, tempUser: { ...open.tempUser, heightIn: inches, heightInches: inches === "" && !open?.tempUser?.heightFt ? null : total } });
                    }}
                    placeholder="in"
                    style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent', width: 48 }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: 14 }}>in</span>
                </div>
              </fieldset>
              {/* Sex — used for demographic health comparisons */}
              <fieldset className="notched-field">
                <legend className="notched-label">Sex</legend>
                <select
                  value={open?.tempUser?.sex ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, sex: e.target.value } })}
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent', width: '100%', fontSize: 'inherit', fontFamily: 'inherit', color: open?.tempUser?.sex ? 'inherit' : '#9ca3af' }}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>Used to compare your results with similar demographics.</p>
              </fieldset>
              <fieldset className="notched-field">
                <legend className="notched-label">Home zip code</legend>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="postal-code"
                  data-lpignore="true"
                  value={open?.tempUser?.zipCode ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, zipCode: e.target.value } })}
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', padding: '2px 0 4px', background: 'transparent' }}
                />
              </fieldset>
            </div>

            <DialogFooter style={{ justifyContent: 'center', marginTop: 0, padding: '16px 24px 20px' }}>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={async () => {
                const next = { ...(open?.tempUser ?? user) };

                // If the user picked a new photo, upload it to S3 first
                if (open._photoFile) {
                  try {
                    next.photo = await uploadPhoto(open._photoFile, authToken);
                  } catch (err) {
                    console.warn("Photo upload failed, saving without photo change:", err);
                    next.photo = user.photo ?? null; // keep old photo on failure
                  }
                } else if (next.photo?.startsWith("blob:")) {
                  // Stale blob URL (shouldn't happen, but guard it)
                  next.photo = user.photo ?? null;
                }

                setUser(next);
                try { localStorage.setItem('user', JSON.stringify(next)); } catch { }
                // Persist to backend (fire-and-forget — UI doesn't wait)
                saveProfileToBackend(authToken, {
                  firstName:    next.firstName,
                  lastName:     next.lastName,
                  dob:          next.dob          ?? null,
                  photo:        next.photo        ?? null,
                  heightInches: next.heightInches ?? null,
                  sex:          next.sex          ?? null,
                  zipCode:      next.zipCode      ?? null,
                  referenceUrl: next.referenceUrl ?? null,
                }).catch(err => console.warn("Profile save to backend failed:", err));
                setOpen(null);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Connected Services */}
        {open?.type === "services" && (
          <DialogContent>
            <DialogHeader style={{ textAlign: "center", marginBottom: 16 }}>
              <DialogTitle>Connected Services</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label>Connected services</Label>
                  {!open?.addingService && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn-icon"
                      aria-label="Add a service"
                      title="Add a service"
                      style={{ border: '1px solid #e5e7eb', background: '#fff' }}
                      onClick={() => setOpen({ ...open, addingService: true, tempService: { provider: 'Fitbit', username: '', password: '' } })}
                    >
                      <Plus size={16} />
                    </Button>
                  )}
                </div>
                <div style={{ marginTop: 8 }}>
                  {(open?.tempUser?.services?.length ?? 0) === 0 ? (
                    <div style={{ fontSize: 12, color: '#6b7280' }}>No services connected</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                      {(open?.tempUser?.services ?? []).map((svc, idx) => (
                        <li
                          key={idx}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px' }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{svc.provider}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{svc.username || '—'}</div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            style={{ padding: '4px 8px', fontSize: 12, height: 28, background: '#fff', color: '#dc2626', borderColor: '#e5e7eb' }}
                            onClick={() => {
                              const nextSvcs = (open?.tempUser?.services ?? []).filter((_, i) => i !== idx);
                              setOpen({ ...open, tempUser: { ...open.tempUser, services: nextSvcs } });
                            }}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {open?.addingService && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 12, display: 'grid', gap: 8 }}>
                    <div>
                      <Label htmlFor="svc-provider">Service</Label>
                      <select
                        id="svc-provider"
                        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #e5e7eb' }}
                        value={open?.tempService?.provider ?? 'Fitbit'}
                        onChange={(e) => setOpen({ ...open, tempService: { ...open.tempService, provider: e.target.value } })}
                      >
                        {['Fitbit', 'Apple Health', 'Google Fit', 'Withings', 'Oura', 'Dexcom'].map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="svc-username">Username or email</Label>
                      <Input
                        id="svc-username"
                        type="text"
                        autoComplete="off"
                        data-lpignore="true"
                        value={open?.tempService?.username ?? ''}
                        onChange={(e) => setOpen({ ...open, tempService: { ...open.tempService, username: e.target.value } })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="svc-password">Password</Label>
                      <Input
                        id="svc-password"
                        type="password"
                        autoComplete="new-password"
                        data-lpignore="true"
                        value={open?.tempService?.password ?? ''}
                        onChange={(e) => setOpen({ ...open, tempService: { ...open.tempService, password: e.target.value } })}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            {open?.addingService ? (
              <DialogFooter style={{ justifyContent: 'center', marginTop: 28 }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen({ ...open, addingService: false, tempService: undefined })}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const svc = { ...(open?.tempService ?? {}) };
                    if (!svc.provider) return;
                    const nextSvcs = [
                      ...((open?.tempUser?.services) ?? []),
                      { provider: svc.provider, username: svc.username ?? '', password: svc.password ?? '', linkedAt: new Date().toISOString() }
                    ];
                    setOpen({ ...open, tempUser: { ...open.tempUser, services: nextSvcs }, addingService: false, tempService: undefined });
                  }}
                >
                  Link service
                </Button>
              </DialogFooter>
            ) : (
              <DialogFooter style={{ justifyContent: 'center', marginTop: 28 }}>
                <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
                <Button onClick={() => {
                  const next = { ...(open?.tempUser ?? user) };
                  setUser(next);
                  try { localStorage.setItem('user', JSON.stringify(next)); } catch { }
                  setOpen(null);
                }}>Save</Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}

        {/* Import Data */}
        {open?.type === "import" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Data</DialogTitle>
            </DialogHeader>
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280' }}>
              Import functionality coming soon...
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Export Data */}
        {open?.type === "export" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Data</DialogTitle>
            </DialogHeader>
            <div style={{ padding: '20px 0', textAlign: 'center', color: '#6b7280' }}>
              Export functionality coming soon...
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Add Metric */}
        {open?.type === "add-metric" && (
          <DialogContent className="narrow-dialog add-metric-dialog">

            {/* ── Screen 1: Catalog ── */}
            {open.screen === 'catalog' && (<>
              <DialogHeader>
                <DialogTitle>Add a Metric</DialogTitle>
              </DialogHeader>
              {(() => {
                if (open.catalog === null) {
                  return <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px 0', fontSize: 13 }}>Loading…</div>;
                }
                const available = open.catalog ?? [];
                return (
                  <div className="picker-scroll" style={{ display: 'grid', gap: 6, marginBottom: 8, maxHeight: 280, overflowY: 'auto' }}>
                    {available.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#9ca3af', padding: '16px 0', fontSize: 13 }}>
                        All available metrics are already on your dashboard.
                      </div>
                    )}
                    {available.map(m => {
                      const Icon = METRIC_ICONS[m.icon] ?? Activity;
                      return (
                        <button
                          key={m.metricId}
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API}/subscription`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                                body: JSON.stringify({ metricId: m.metricId }),
                              });
                              if (!res.ok) {
                                const err = await res.json().catch(() => ({}));
                                alert(`Could not subscribe: ${err.error || res.status}`);
                                return;
                              }
                            } catch (e) {
                              alert(`Network error: ${e.message}`);
                              return;
                            }
                            await fetchAndApplySubscriptions(authToken);
                            const next = [...activeCards, m.metricId];
                            setActiveCards(next);
                            try { localStorage.setItem('activeCards', JSON.stringify(next)); } catch {}
                            setOpen(null);
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                          onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
                          onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                        >
                          <Icon size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{m.friendlyName}{m.reactivate ? ' (re-activate)' : ''}</div>
                            {m.uom && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Measured in {m.uom}</div>}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setOpen({ ...open, screen: 'custom' })}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', border: '1.5px dashed #d1d5db', borderRadius: 8, background: 'transparent', cursor: 'pointer', marginTop: 2 }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.background = 'transparent'; }}
                    >
                      <Plus size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#4f46e5' }}>Define your own metric</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Create a custom health measurement</div>
                      </div>
                    </button>
                  </div>
                );
              })()}
              <DialogFooter style={{ marginTop: 8 }}>
                <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
              </DialogFooter>
            </>)}

            {/* ── Screen 2: Custom metric form ── */}
            {open.screen === 'custom' && (<>
              <DialogHeader style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontSize: 18, color: '#6b7280', lineHeight: 1 }}
                  onClick={() => {
                    if (open._returnTo) {
                      setOpen({ ...open._returnTo, screen: 'pick-metric', saveError: undefined });
                    } else {
                      setOpen({ ...open, screen: 'catalog', tempDefError: undefined });
                    }
                  }}
                  aria-label="Back"
                >←</button>
                <DialogTitle>New Metric</DialogTitle>
              </DialogHeader>

              <div className="custom-metric-form">
                {/* Friendly Name */}
                <fieldset className="notched-field">
                  <legend className="notched-label">Friendly Name *</legend>
                  <input
                    type="text" autoFocus
                    value={open.tempDef?.friendly_name ?? ''}
                    onChange={e => {
                      const friendly_name = e.target.value;
                      const metric_id = slugify(friendly_name);
                      setOpen({ ...open, tempDef: { ...open.tempDef, friendly_name, metric_id }, tempDefError: undefined });
                    }}
                    style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                  />
                </fieldset>
                {open.tempDef?.metric_id && (
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -6 }}>
                    id: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>{open.tempDef.metric_id}</code>
                  </div>
                )}

                {/* Icon picker */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon</div>
                  <div className="metric-icon-grid">
                    {Object.entries(METRIC_ICONS).map(([name, IconComp]) => (
                      <button key={name} type="button"
                        className={`metric-icon-btn${(open.tempDef?.icon ?? 'Activity') === name ? ' selected' : ''}`}
                        title={name}
                        onClick={() => setOpen({ ...open, tempDef: { ...open.tempDef, icon: name } })}
                      ><IconComp size={17} /></button>
                    ))}
                  </div>
                </div>

                {/* Reference URL */}
                <fieldset className="notched-field">
                  <legend className="notched-label">Reference URL</legend>
                  <input type="url"
                    value={open.tempDef?.info_url ?? ''}
                    onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, info_url: e.target.value } })}
                    placeholder="https://"
                    style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                  />
                </fieldset>

                {/* Value Type */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Value Type</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['numeric', 'Numeric'], ['boolean', 'Yes / No'], ['string', 'Text']].map(([val, label]) => (
                      <button key={val} type="button"
                        className={`value-type-btn${(open.tempDef?.value_type ?? 'numeric') === val ? ' selected' : ''}`}
                        onClick={() => setOpen({ ...open, tempDef: { ...open.tempDef, value_type: val } })}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Numeric options */}
                {(open.tempDef?.value_type ?? 'numeric') === 'numeric' && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tracking Style</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { val: null,         label: 'Flexible',    hint: 'No strong convention' },
                          { val: 'standalone', label: 'Standalone',  hint: 'Each reading is independent (weight, heart rate)' },
                          { val: 'cumulative', label: 'Cumulative',  hint: 'Entries add up toward a total (steps, miles)' },
                        ].map(({ val, label, hint }) => {
                          const isSelected = (open.tempDef?.tracking_flavor ?? null) === val;
                          return (
                            <button key={String(val)} type="button" title={hint}
                              style={{
                                flex: 1, padding: '6px 10px', border: '2px solid', borderRadius: 8,
                                cursor: 'pointer', fontSize: 12, fontWeight: isSelected ? 600 : 400,
                                borderColor: isSelected ? '#6366f1' : '#e5e7eb',
                                background:  isSelected ? '#eef2ff' : 'white',
                                color:       isSelected ? '#4f46e5' : '#374151',
                                transition: 'all 0.15s',
                              }}
                              onClick={() => setOpen({ ...open, tempDef: { ...open.tempDef, tracking_flavor: val } })}
                            >{label}</button>
                          );
                        })}
                      </div>
                    </div>
                    <fieldset className="notched-field">
                      <legend className="notched-label">Unit of Measure</legend>
                      <input type="text"
                        value={open.tempDef?.uom ?? ''}
                        onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, uom: e.target.value } })}
                        placeholder="lbs, bpm, mmHg, °F …"
                        style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                      />
                    </fieldset>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>Use slider instead of free entry</span>
                      <button type="button"
                        className={`slider-toggle${open.tempDef?.slider_enabled ? ' on' : ''}`}
                        onClick={() => setOpen({ ...open, tempDef: { ...open.tempDef, slider_enabled: !open.tempDef?.slider_enabled } })}
                        aria-label="Toggle slider"
                      />
                    </div>
                    {open.tempDef?.slider_enabled && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <fieldset className="notched-field" style={{ flex: 1 }}>
                          <legend className="notched-label">Min</legend>
                          <input type="number" value={open.tempDef?.logical_min ?? 0}
                            onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, logical_min: Number(e.target.value) } })}
                            style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }} />
                        </fieldset>
                        <fieldset className="notched-field" style={{ flex: 1 }}>
                          <legend className="notched-label">Max</legend>
                          <input type="number" value={open.tempDef?.logical_max ?? 10}
                            onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, logical_max: Number(e.target.value) } })}
                            style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }} />
                        </fieldset>
                      </div>
                    )}
                  </div>
                )}

                {/* Boolean options */}
                {open.tempDef?.value_type === 'boolean' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <fieldset className="notched-field" style={{ flex: 1 }}>
                      <legend className="notched-label">False label</legend>
                      <input type="text" value={open.tempDef?.false_tag ?? 'No'}
                        onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, false_tag: e.target.value } })}
                        style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }} />
                    </fieldset>
                    <fieldset className="notched-field" style={{ flex: 1 }}>
                      <legend className="notched-label">True label</legend>
                      <input type="text" value={open.tempDef?.true_tag ?? 'Yes'}
                        onChange={e => setOpen({ ...open, tempDef: { ...open.tempDef, true_tag: e.target.value } })}
                        style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }} />
                    </fieldset>
                  </div>
                )}

                {open.tempDefError && (
                  <div style={{ color: '#dc2626', fontSize: 13 }}>{open.tempDefError}</div>
                )}
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => {
                  if (open._returnTo) {
                    setOpen({ ...open._returnTo, screen: 'pick-metric', saveError: undefined });
                  } else {
                    setOpen({ ...open, screen: 'catalog', tempDefError: undefined });
                  }
                }}>Back</Button>
                <Button onClick={handleSaveCustomMetric}>Save Metric</Button>
              </DialogFooter>
            </>)}

          </DialogContent>
        )}

        {/* Single Value Metrics */}
        {open?.metricNames && (
          <DialogContent className="narrow-dialog">
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
            </DialogHeader>
            <div>
              {/* Multi-metric summary view when timestamps differ or some missing */}
              {open?.showMultiMetricSummary && open?.multiMetricEntries && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, marginBottom: 12, color: '#6b7280' }}>
                    Last readings taken at different times:
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginBottom: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                    {open.multiMetricEntries.map((me, meIdx) => {
                      const cfg = metricConfig[me.metricName];
                      const label = cfg.prompt ?? toSentenceCase(me.metricName);
                      if (!me.lastEntry) {
                        return (
                          <div key={me.metricName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
                            <div style={{ color: '#9ca3af' }}>
                              • {label}: <em>no data</em>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const toIsoDate = (d) => {
                                  const yyyy = d.getFullYear();
                                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                                  const dd = String(d.getDate()).padStart(2, '0');
                                  return `${yyyy}-${mm}-${dd}`;
                                };
                                const now = new Date();
                                const isToday = toKey(selectedDate) === toKey(new Date());
                                const defaultTime = isToday
                                  ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                                  : '09:00';
                                setOpen({
                                  type: me.metricName,
                                  title: label,
                                  metricNames: [me.metricName],
                                  metricValues: [{ ...open.metricValues[meIdx], value: null }],
                                  tempEntryDate: toIsoDate(selectedDate),
                                  tempEntryTime: defaultTime,
                                  entryAction: undefined,
                                  editEntryTs: undefined,
                                  showMultiMetricSummary: false,
                                });
                              }}
                              style={{ padding: '4px 8px', fontSize: 12 }}
                            >
                              Add
                            </Button>
                          </div>
                        );
                      }
                      const dt = new Date(me.lastEntry.ts);
                      const hours = dt.getHours();
                      const minutes = dt.getMinutes();
                      const ampm = hours >= 12 ? 'pm' : 'am';
                      const hours12 = hours % 12 || 12;
                      const timeStr = `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;

                      let valueStr = '';
                      if (cfg.kind === 'slider') {
                        valueStr = String(me.lastEntry.value);
                      } else if (cfg.kind === 'switch') {
                        valueStr = me.lastEntry.value === true ? 'Yes' : me.lastEntry.value === false ? 'No' : '—';
                      } else {
                        valueStr = `${me.lastEntry.value ?? '—'}${cfg.uom ? ` ${cfg.uom}` : ''}`;
                      }

                      return (
                        <div key={me.metricName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 }}>
                          <div>
                            • {label}: <strong>{valueStr}</strong> at {timeStr}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              const toIsoDate = (d) => {
                                const yyyy = d.getFullYear();
                                const mm = String(d.getMonth() + 1).padStart(2, '0');
                                const dd = String(d.getDate()).padStart(2, '0');
                                return `${yyyy}-${mm}-${dd}`;
                              };
                              const timeStr2 = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                              setOpen({
                                type: me.metricName,
                                title: label,
                                metricNames: [me.metricName],
                                metricValues: [{ ...open.metricValues[meIdx], value: me.lastEntry.value }],
                                tempEntryDate: toIsoDate(dt),
                                tempEntryTime: timeStr2,
                                editEntryTs: me.lastEntry.ts,
                                entryAction: 'update',
                                showMultiMetricSummary: false,
                              });
                            }}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            <Edit size={14} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      // Clear values and switch to fresh add mode (like no data exists)
                      const now = new Date();
                      const isToday = toKey(selectedDate) === toKey(new Date());
                      const defaultTime = isToday
                        ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        : '09:00';
                      const clearedValues = open.metricValues.map(mv => ({ ...mv, value: null }));
                      setOpen({
                        ...open,
                        showMultiMetricSummary: false,
                        metricValues: clearedValues,
                        tempEntryTime: defaultTime,
                        entryAction: undefined, // No toggle buttons
                        editEntryTs: undefined,
                        isMultiMetricGrouped: false,
                      });
                    }}
                    style={{ width: '100%' }}
                  >
                    Update All
                  </Button>
                </div>
              )}

              {/* Multi-entry list view for single-metric cards with >1 entry on this day */}
              {(() => {
                const isSingle = (open?.metricNames?.length ?? 0) === 1;
                if (!isSingle || !open?.showEntryList) {
                  return null;
                }
                const metricName = open.metricNames[0];
                const data = (records.dataPoints ?? {})[metricName] ?? {};
                const entries = Array.isArray(data.entries) ? data.entries : [];
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const startMs = dayStart.getTime();
                const endMs = startMs + 24 * 60 * 60 * 1000;
                const dayEntries = entries.filter(e => e.ts >= startMs && e.ts < endMs).sort((a, b) => b.ts - a.ts);
                const cfg = metricConfig[metricName];
                const formatValue = (v) => {
                  if (cfg.kind === "slider") return String(v);
                  if (cfg.kind === "switch") return v === true ? "Yes" : v === false ? "No" : "—";
                  return `${v ?? "—"}${cfg.uom ? ` ${cfg.uom}` : ""}`;
                };
                const format12Hour = (dt) => {
                  let hours = dt.getHours();
                  const minutes = dt.getMinutes();
                  const ampm = hours >= 12 ? 'pm' : 'am';
                  hours = hours % 12 || 12;
                  return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
                };
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, marginBottom: 8, color: '#6b7280' }}>Existing entries for this day:</div>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                      {dayEntries.map((e) => {
                        const dt = new Date(e.ts);
                        const timeStr = format12Hour(dt);
                        return (
                          <div key={e.ts} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, backgroundColor: '#f9fafb' }}>
                            <div style={{ fontSize: 14 }}>
                              <span style={{ fontWeight: 600 }}>{timeStr}</span>
                              {' • '}
                              <span>{formatValue(e.value)}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const toIsoDate = (d) => {
                                  const yyyy = d.getFullYear();
                                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                                  const dd = String(d.getDate()).padStart(2, '0');
                                  return `${yyyy}-${mm}-${dd}`;
                                };
                                const timeStr2 = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                                const mv = [{ ...open.metricValues[0], value: e.value }];
                                setOpen({
                                  ...open,
                                  metricValues: mv,
                                  tempEntryDate: toIsoDate(dt),
                                  tempEntryTime: timeStr2,
                                  editEntryTs: e.ts,
                                  entryAction: 'update',
                                  showEntryList: false,
                                });
                              }}
                              style={{ padding: '4px 8px', fontSize: 12 }}
                            >
                              Edit
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const toIsoDate = (d) => {
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          return `${yyyy}-${mm}-${dd}`;
                        };
                        setOpen({
                          ...open,
                          metricValues: [{ ...open.metricValues[0], value: null }],
                          tempEntryDate: toIsoDate(selectedDate),
                          tempEntryTime: '',
                          editEntryTs: undefined,
                          entryAction: 'add',
                          showEntryList: false,
                        });
                      }}
                      style={{ width: '100%' }}
                    >
                      Add new entry
                    </Button>
                  </div>
                );
              })()}
              {/* Only show input fields when NOT showing entry list or multi-metric summary */}
              {!open?.showEntryList && !open?.showMultiMetricSummary && open.metricNames.map((metricName, idx) => {
                const cfg = metricConfig[metricName];
                const kind = cfg.kind;
                const promptText = cfg.prompt ?? toSentenceCase(metricName);

                if (kind === "slider") {
                  const sliderMin = cfg.logicalMin ?? 0;
                  const sliderMax = cfg.logicalMax ?? 10;
                  const sliderUom = cfg.uom ? ` ${cfg.uom}` : '';
                  return (
                    <div key={metricName} style={{ marginBottom: 16 }}>
                      <Label htmlFor={metricName}>{promptText}</Label>
                      <div style={{ maxWidth: 320 }}>
                        <Slider
                          id={metricName}
                          value={[open.metricValues?.[idx]?.value ?? sliderMin]}
                          min={sliderMin}
                          max={sliderMax}
                          step={1}
                          onValueChange={(v) => {
                            const updatedValues = [...(open.metricValues ?? [])];
                            updatedValues[idx] = { ...updatedValues[idx], value: v[0] };
                            setOpen({ ...open, metricValues: updatedValues });
                          }}
                        />
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                          <span>{sliderMin}{sliderUom}</span>
                          <span style={{ fontSize: '24px', fontWeight: 600, color: "#222", margin: "0 12px" }}>
                            {open.metricValues?.[idx]?.value ?? sliderMin}{sliderUom}
                          </span>
                          <span>{sliderMax}{sliderUom}</span>
                        </div>
                      </div>
                    </div>
                  );
                } else if (kind === "switch") {
                  const currentValue = open.metricValues?.[idx]?.value;
                  return (
                    <div key={metricName} style={{ marginBottom: 16 }}>
                      <Label htmlFor={metricName}>{promptText}</Label>
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-start" }}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const updatedValues = [...(open.metricValues ?? [])];
                            updatedValues[idx] = { ...updatedValues[idx], value: true };
                            setOpen({ ...open, metricValues: updatedValues });
                          }}
                          style={{
                            padding: "6px 16px",
                            fontSize: "14px",
                            height: "auto",
                            minWidth: "60px",
                            backgroundColor: currentValue === true ? "#10b981" : "transparent",
                            color: currentValue === true ? "white" : "inherit",
                            borderColor: currentValue === true ? "#10b981" : "inherit"
                          }}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const updatedValues = [...(open.metricValues ?? [])];
                            updatedValues[idx] = { ...updatedValues[idx], value: false };
                            setOpen({ ...open, metricValues: updatedValues });
                          }}
                          style={{
                            padding: "6px 16px",
                            fontSize: "14px",
                            height: "auto",
                            minWidth: "60px",
                            backgroundColor: currentValue === false ? "#ef4444" : "transparent",
                            color: currentValue === false ? "white" : "inherit",
                            borderColor: currentValue === false ? "#ef4444" : "inherit"
                          }}
                        >
                          No
                        </Button>
                      </div>
                    </div>
                  );
                } else if (kind === 'text') {
                  return (
                    <div key={metricName} style={{ marginBottom: 12 }}>
                      <Label htmlFor={metricName}>{promptText}</Label>
                      <Input
                        id={metricName}
                        type="text"
                        style={{ width: "auto" }}
                        value={open.metricValues?.[idx]?.value ?? ""}
                        onChange={(e) => {
                          const newValue = e.target.value !== '' ? e.target.value : null;
                          const updatedValues = [...(open.metricValues ?? [])];
                          updatedValues[idx] = { ...updatedValues[idx], value: newValue };
                          setOpen({ ...open, metricValues: updatedValues });
                        }}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div key={metricName} style={{ marginBottom: 12 }}>
                      <Label htmlFor={metricName}>{promptText}{cfg.uom ? ` (${cfg.uom})` : ""}</Label>
                      <Input
                        id={metricName}
                        type="number"
                        style={{ width: "auto" }}
                        value={open.metricValues?.[idx]?.value ?? ""}
                        onChange={(e) => {
                          const newValue = e.target.value !== '' ? Number(e.target.value) : null;
                          const updatedValues = [...(open.metricValues ?? [])];
                          updatedValues[idx] = { ...updatedValues[idx], value: newValue };
                          setOpen({ ...open, metricValues: updatedValues });
                        }}
                      />
                    </div>
                  );
                }
              })}
            </div>
            {/* Secondary action: offer adding a new entry when currently editing an existing one */}
            {!open?.showEntryList && !open?.showMultiMetricSummary && (open?.entryAction === 'update' || typeof open?.editEntryTs === 'number') && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    // Enter add mode: clear values and time, hide this button afterwards
                    const updatedValues = (open.metricValues ?? []).map(mv => ({ ...mv, value: null }));
                    setOpen({
                      ...open,
                      entryAction: 'add',
                      metricValues: updatedValues,
                      tempEntryTime: '',
                      editEntryTs: undefined
                    });
                  }}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Add a new entry
                </Button>
              </div>
            )}
            {/* Timestamp controls moved to bottom above actions for cleaner layout - hide when showing entry list or summary */}
            {!open?.showEntryList && !open?.showMultiMetricSummary && (
              <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 12 }}>
                {/* Show data source for the entry being edited (exclude manual entry) */}
                {typeof open?.editEntryTs === 'number' && (() => {
                  const ts = open.editEntryTs;
                  const names = open?.metricNames ?? [];
                  const collected = new Set();
                  names.forEach((metricName) => {
                    const data = (records.dataPoints ?? {})[metricName] ?? {};
                    const entries = Array.isArray(data.entries) ? data.entries : [];
                    const ent = entries.find(e => e.ts === ts);
                    const src = ent?.source;
                    if (src && src !== 'manual entry') collected.add(src);
                  });
                  const list = Array.from(collected);
                  if (list.length === 0) return null;
                  const label = list.length === 1 ? 'Source' : 'Sources';
                  return (
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                      {label}: {list.join(', ')}
                    </div>
                  );
                })()}
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }} title="Date and Time this data was captured">As of</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn-icon"
                      aria-label="Select date"
                      title="Select date"
                      style={{ width: 28, height: 28, padding: 0, background: 'transparent', border: 'none' }}
                      onClick={() => {
                        const el = document.getElementById('entry-date');
                        if (el) {
                          // @ts-ignore
                          if (typeof el.showPicker === 'function') el.showPicker(); else el.focus();
                        }
                      }}
                    >
                      <CalendarDays size={14} />
                    </Button>
                    <Input
                      id="entry-date"
                      type="date"
                      autoComplete="off"
                      data-lpignore="true"
                      aria-label="Entry date"
                      className="no-native-picker"
                      style={{ fontSize: 14, border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
                      value={open?.tempEntryDate ?? ''}
                      onChange={(e) => setOpen({ ...open, tempEntryDate: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="btn-icon"
                      aria-label="Select time"
                      title="Select time"
                      style={{ width: 28, height: 28, padding: 0, background: 'transparent', border: 'none' }}
                      onClick={() => {
                        const el = document.getElementById('entry-time');
                        if (el) {
                          // @ts-ignore
                          if (typeof el.showPicker === 'function') el.showPicker(); else el.focus();
                        }
                      }}
                    >
                      <Clock size={14} />
                    </Button>
                    <Input
                      id="entry-time"
                      type="time"
                      step={60}
                      autoComplete="off"
                      data-lpignore="true"
                      aria-label="Entry time"
                      className="no-native-picker"
                      style={{ fontSize: 14, border: 'none', outline: 'none', boxShadow: 'none', padding: 0 }}
                      value={open?.tempEntryTime ?? ''}
                      onChange={(e) => setOpen({ ...open, tempEntryTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {!open?.showEntryList && !open?.showMultiMetricSummary && (
              <DialogFooter style={{ justifyContent: 'center', marginTop: 20 }}>
                <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
                <Button onClick={() => {
                  // Validate time is provided
                  if (!open?.tempEntryTime || open.tempEntryTime.trim() === '') {
                    alert('Please select a time for this entry.');
                    return;
                  }

                  // Build timestamp based on chosen date/time
                  let ts = Date.now();
                  try {
                    const dateStr = open?.tempEntryDate; // YYYY-MM-DD
                    const timeStr = open?.tempEntryTime; // HH:MM
                    if (dateStr && timeStr) {
                      const d = new Date(`${dateStr}T${timeStr}:00`);
                      if (!isNaN(d.getTime())) ts = d.getTime();
                    }
                  } catch { }

                  const isSingle = (open?.metricNames?.length ?? 0) === 1;
                  const isMultiGrouped = open?.isMultiMetricGrouped === true;

                  // Check for timestamp collision when adding a new entry
                  if (isSingle && open?.entryAction === 'add') {
                    const metricName = open.metricNames[0];
                    const data = (records.dataPoints ?? {})[metricName] ?? {};
                    const entries = Array.isArray(data.entries) ? data.entries : [];
                    const existingEntry = entries.find(e => e.ts === ts);

                    if (existingEntry) {
                      const dt = new Date(ts);
                      const timeStr = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
                      const ampm = dt.getHours() >= 12 ? 'pm' : 'am';
                      const hours12 = dt.getHours() % 12 || 12;
                      const time12 = `${hours12}:${String(dt.getMinutes()).padStart(2, '0')} ${ampm}`;

                      if (!window.confirm(`An entry already exists at ${time12}. This will overwrite the existing value. Continue?`)) {
                        return;
                      }
                    }
                  }

                  if ((isSingle || isMultiGrouped) && open?.entryAction === 'update' && typeof open?.editEntryTs === 'number') {
                    // Update the existing entry/grouped reading (replace, and move if timestamp changed)
                    open.metricNames.forEach((metricName, idx) => {
                      const cfg = metricConfig[metricName];
                      const rawValue = open.metricValues?.[idx]?.value;
                      const inputValue = rawValue != null ? rawValue : (cfg?.kind === 'slider' ? (cfg?.logicalMin ?? 0) : rawValue);
                      updateDayValues({
                        metric: metricName,
                        inputValue,
                        ts,
                        editTs: open.editEntryTs,
                      });
                    });
                  } else {
                    // Add new entry (collision check already handled above with confirmation)
                    open.metricNames.forEach((metricName, idx) => {
                      const cfg = metricConfig[metricName];
                      const rawValue = open.metricValues?.[idx]?.value;
                      const inputValue = rawValue != null ? rawValue : (cfg?.kind === 'slider' ? (cfg?.logicalMin ?? 0) : rawValue);
                      updateDayValues({ metric: metricName, inputValue, ts });
                    });
                  }
                  setOpen(null);
                }}>Save</Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}

        {/* Goal Wizard */}
        {open?.type === 'goal-wizard' && (
          <DialogContent className="goal-wizard-dialog">
            <DialogHeader>
              <DialogTitle>
                {open.editGoalId ? 'Edit Goal' : 'Set a Goal'}{open.metricTitle ? ` — ${open.metricTitle}` : ''}
              </DialogTitle>
            </DialogHeader>

            {/* ── Wizard (new goals) ── */}
            {open.screen === 'wizard' && (
              <GoalWizard
                open={open}
                setOpen={setOpen}
                onSave={handleSaveGoal}
                metricConfig={metricConfig}
                templates={METRIC_GOAL_TEMPLATES[open.metricId] ?? []}
              />
            )}

            {/* ── Screen: Configure (edits only) ── */}
            {open.screen === 'configure' && (() => {
              const draft = open.draft ?? {};
              const GOAL_TYPE_OPTIONS = [
                { value: 'target_value', label: 'Target Value' },
                { value: 'cumulative',   label: 'Cumulative' },
                { value: 'range',        label: 'Range' },
                { value: 'streak',       label: 'Streak' },
                { value: 'best_of',      label: 'Personal Best' },
              ];
              const PERIOD_OPTIONS = [
                { value: 'daily',    label: 'Daily' },
                { value: 'weekly',   label: 'Weekly' },
                { value: 'monthly',  label: 'Monthly' },
                { value: 'rolling',  label: 'Rolling' },
                { value: 'all_time', label: 'All Time' },
              ];
              return (
                <>
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <Label>Goal Name</Label>
                      <Input
                        value={draft.name ?? ''}
                        placeholder="e.g. Reach target weight"
                        onChange={e => setOpen({ ...open, draft: { ...draft, name: e.target.value } })}
                      />
                    </div>
                    <div>
                      <Label>Goal Type</Label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {GOAL_TYPE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setOpen({ ...open, draft: { ...draft, goalType: opt.value } })}
                            style={{
                              padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid',
                              borderColor: draft.goalType === opt.value ? '#6366f1' : '#d1d5db',
                              background: draft.goalType === opt.value ? '#eef2ff' : 'white',
                              color: draft.goalType === opt.value ? '#4f46e5' : '#374151',
                              fontWeight: draft.goalType === opt.value ? 600 : 400,
                            }}
                          >{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    {(draft.goalType === 'target_value' || draft.goalType === 'cumulative' || draft.goalType === 'best_of') && (
                      <div>
                        <Label>Target Value</Label>
                        <Input
                          type="number"
                          style={{ width: 'auto' }}
                          value={draft.targetValue ?? ''}
                          onChange={e => setOpen({ ...open, draft: { ...draft, targetValue: e.target.value !== '' ? Number(e.target.value) : null } })}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          {[{ v: 'lower_is_better', label: '↓ Lower is better' }, { v: 'higher_is_better', label: '↑ Higher is better' }].map(d => (
                            <button
                              key={d.v}
                              onClick={() => setOpen({ ...open, draft: { ...draft, direction: d.v } })}
                              style={{
                                padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid',
                                borderColor: draft.direction === d.v ? '#6366f1' : '#d1d5db',
                                background: draft.direction === d.v ? '#eef2ff' : 'white',
                                color: draft.direction === d.v ? '#4f46e5' : '#374151',
                                fontWeight: draft.direction === d.v ? 600 : 400,
                              }}
                            >{d.label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {draft.goalType === 'target_value' && (
                      <div>
                        <Label>Starting Value <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Label>
                        <Input
                          type="number"
                          style={{ width: 'auto' }}
                          placeholder="Your value at the start"
                          value={draft.startingValue ?? ''}
                          onChange={e => setOpen({ ...open, draft: { ...draft, startingValue: e.target.value !== '' ? Number(e.target.value) : null } })}
                        />
                      </div>
                    )}
                    {draft.goalType === 'range' && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <Label>Min</Label>
                          <Input type="number" style={{ width: 'auto' }} value={draft.targetMin ?? ''} onChange={e => setOpen({ ...open, draft: { ...draft, targetMin: e.target.value !== '' ? Number(e.target.value) : null } })} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <Label>Max</Label>
                          <Input type="number" style={{ width: 'auto' }} value={draft.targetMax ?? ''} onChange={e => setOpen({ ...open, draft: { ...draft, targetMax: e.target.value !== '' ? Number(e.target.value) : null } })} />
                        </div>
                      </div>
                    )}
                    {draft.goalType === 'streak' && (
                      <div>
                        <Label>Streak Target (consecutive days)</Label>
                        <Input
                          type="number"
                          style={{ width: 'auto' }}
                          value={draft.streakTarget ?? ''}
                          onChange={e => setOpen({ ...open, draft: { ...draft, streakTarget: e.target.value !== '' ? Number(e.target.value) : null } })}
                        />
                      </div>
                    )}
                    <div>
                      <Label>Period</Label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                        {PERIOD_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setOpen({ ...open, draft: { ...draft, period: opt.value } })}
                            style={{
                              padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid',
                              borderColor: draft.period === opt.value ? '#6366f1' : '#d1d5db',
                              background: draft.period === opt.value ? '#eef2ff' : 'white',
                              color: draft.period === opt.value ? '#4f46e5' : '#374151',
                              fontWeight: draft.period === opt.value ? 600 : 400,
                            }}
                          >{opt.label}</button>
                        ))}
                      </div>
                      {draft.period === 'rolling' && (
                        <div style={{ marginTop: 8 }}>
                          <Label>Rolling Window (days)</Label>
                          <Input
                            type="number"
                            style={{ width: 'auto' }}
                            value={draft.periodDays ?? ''}
                            onChange={e => setOpen({ ...open, draft: { ...draft, periodDays: e.target.value !== '' ? Number(e.target.value) : null } })}
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>End Date (optional)</Label>
                      <Input
                        type="date"
                        style={{ width: 'auto' }}
                        value={draft.endDate ?? ''}
                        onChange={e => setOpen({ ...open, draft: { ...draft, endDate: e.target.value || null } })}
                      />
                    </div>
                    {open.saveError && <div style={{ color: '#dc2626', fontSize: 13 }}>{open.saveError}</div>}
                  </div>
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
                    <Button onClick={handleSaveGoal} disabled={open.isSaving}>
                      {open.isSaving ? 'Updating…' : 'Update Goal'}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        )}
      </Dialog>

      {/* ===== PROGRAM WIZARD DIALOG ===== */}
      <Dialog open={open?.type === 'program-wizard'} onOpenChange={v => { if (!v) setOpen(null); }}>
        {open?.type === 'program-wizard' && (() => {
          const draft = open.draft ?? {};
          const items = draft.items ?? [];

          // ── Screen: name ──────────────────────────────────────────────
          if (open.screen === 'name') {
            return (
              <DialogContent className="narrow-dialog">
                <DialogHeader>
                  <DialogTitle>{open.programId ? 'Edit Program' : 'Create Program'}</DialogTitle>
                </DialogHeader>
                <div style={{ display: 'grid', gap: 14 }}>
                  <fieldset className="notched-field">
                    <legend className="notched-label">Program Name *</legend>
                    <input
                      type="text" autoFocus
                      value={draft.name ?? ''}
                      onChange={e => setOpen({ ...open, draft: { ...draft, name: e.target.value }, saveError: undefined })}
                      style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                    />
                  </fieldset>
                  <fieldset className="notched-field">
                    <legend className="notched-label">Description (optional)</legend>
                    <input
                      type="text"
                      value={draft.description ?? ''}
                      placeholder="What is this program for?"
                      onChange={e => setOpen({ ...open, draft: { ...draft, description: e.target.value } })}
                      style={{ border: 'none', outline: 'none', width: '100%', background: 'transparent' }}
                    />
                  </fieldset>
                  {open.saveError && <div style={{ color: '#dc2626', fontSize: 13 }}>{open.saveError}</div>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
                  <Button onClick={() => {
                    if (!draft.name?.trim()) { setOpen({ ...open, saveError: 'Please enter a program name.' }); return; }
                    setOpen({ ...open, screen: 'items', saveError: undefined });
                  }}>Next</Button>
                </DialogFooter>
              </DialogContent>
            );
          }

          // ── Screen: items (list of added metric goals) ─────────────────
          if (open.screen === 'items') {
            return (
              <DialogContent className="narrow-dialog">
                <DialogHeader>
                  <DialogTitle>{draft.name}</DialogTitle>
                </DialogHeader>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
                    {items.length === 0
                      ? 'No metric goals yet. Add at least one.'
                      : `${items.length} metric goal${items.length !== 1 ? 's' : ''} added`}
                  </div>
                  {items.map((item, idx) => {
                    const cfg = metricConfig[item.metricId] ?? {};
                    const title = cfg.title || toSentenceCase(item.metricId);
                    return (
                      <div key={item.itemId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.goalName || title}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{title} · {(item.goalType ?? '').replace(/_/g, ' ')} · {item.period}</div>
                        </div>
                        <button
                          onClick={() => setOpen({ ...open, draft: { ...draft, items: items.filter((_, i) => i !== idx) } })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setOpen({ ...open, screen: 'pick-metric', saveError: undefined })}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', border: '1px dashed #d1d5db', borderRadius: 8, background: 'transparent', cursor: 'pointer', marginTop: 4 }}
                  >
                    <Plus size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#4f46e5', fontWeight: 600 }}>Add Metric Goal</span>
                  </button>
                </div>
                {open.saveError && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 6 }}>{open.saveError}</div>}
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen({ ...open, screen: 'name', saveError: undefined })}>Back</Button>
                  <Button onClick={handleSaveProgram} disabled={open.isSaving}>
                    {open.isSaving ? 'Saving…' : open.programId ? 'Update Program' : 'Save & Enroll'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            );
          }

          // ── Screen: pick-metric ────────────────────────────────────────
          if (open.screen === 'pick-metric') {
            const usedMetrics = new Set(items.map(i => i.metricId));
            const available = cardDefinitions.filter(cd => !usedMetrics.has(cd.cardName));
            return (
              <DialogContent className="narrow-dialog">
                <DialogHeader>
                  <DialogTitle>Choose a Metric</DialogTitle>
                </DialogHeader>
                <div className="picker-scroll" style={{ display: 'grid', gap: 6, marginBottom: 8, maxHeight: 320, overflowY: 'auto' }}>
                  {available.length === 0 && (
                    <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0 4px' }}>
                      All subscribed metrics are already in this program.
                    </div>
                  )}
                  {available.map(cd => {
                    const cfg = metricConfig[cd.cardName] ?? {};
                    const Icon = cd.icon ?? Activity;
                    return (
                      <button
                        key={cd.cardName}
                        onClick={() => {
                          const todayIso = new Date().toISOString().split('T')[0];
                          const itemDraft = {
                            ...PROGRAM_ITEM_DEFAULTS,
                            itemId:   `item-${Date.now().toString(36)}`,
                            metricId: cd.cardName,
                            goalName: `${cfg.title || toSentenceCase(cd.cardName)} goal`,
                            startDate: todayIso,
                          };
                          setOpen({ ...open, screen: 'item-goal', itemDraft, saveError: undefined });
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                      >
                        <Icon size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{cfg.title || toSentenceCase(cd.cardName)}</div>
                          {cfg.uom && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Measured in {cfg.uom}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen({ ...open, screen: 'items', saveError: undefined })}>Back</Button>
                  <Button variant="secondary" onClick={() => {
                    const stashedProgramWizard = open;
                    setOpen({ type: 'add-metric', screen: 'custom', catalog: null, _returnTo: stashedProgramWizard });
                  }}><Plus size={13} style={{ marginRight: 4 }} />New Metric</Button>
                </DialogFooter>
              </DialogContent>
            );
          }

          // ── Screen: item-goal (configure the goal for the chosen metric) ──
          if (open.screen === 'item-goal') {
            const id = open.itemDraft ?? {};
            const cfg = metricConfig[id.metricId] ?? {};
            const metricTitle = cfg.title || toSentenceCase(id.metricId ?? '');
            const GOAL_TYPE_OPTIONS = [
              { value: 'target_value', label: 'Target Value' },
              { value: 'cumulative',   label: 'Cumulative' },
              { value: 'range',        label: 'Range' },
              { value: 'streak',       label: 'Streak' },
            ];
            const PERIOD_OPTIONS = [
              { value: 'daily',    label: 'Daily' },
              { value: 'weekly',   label: 'Weekly' },
              { value: 'monthly',  label: 'Monthly' },
              { value: 'rolling',  label: 'Rolling' },
              { value: 'all_time', label: 'All Time' },
            ];
            return (
              <DialogContent className="narrow-dialog">
                <DialogHeader>
                  <DialogTitle>Goal for {metricTitle}</DialogTitle>
                </DialogHeader>
                <div style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <Label>Goal Name</Label>
                    <Input
                      value={id.goalName ?? ''}
                      placeholder={`e.g. Weekly ${metricTitle} target`}
                      onChange={e => setOpen({ ...open, itemDraft: { ...id, goalName: e.target.value } })}
                    />
                  </div>
                  <div>
                    <Label>Goal Type</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {GOAL_TYPE_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => setOpen({ ...open, itemDraft: { ...id, goalType: opt.value } })}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid', borderColor: id.goalType === opt.value ? '#6366f1' : '#d1d5db', background: id.goalType === opt.value ? '#eef2ff' : 'white', color: id.goalType === opt.value ? '#4f46e5' : '#374151', fontWeight: id.goalType === opt.value ? 600 : 400 }}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  {(id.goalType === 'target_value' || id.goalType === 'cumulative') && (
                    <div>
                      <Label>Target Value</Label>
                      <Input type="number" style={{ width: 'auto' }} value={id.targetValue ?? ''} onChange={e => setOpen({ ...open, itemDraft: { ...id, targetValue: e.target.value !== '' ? Number(e.target.value) : null } })} />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        {[{ v: 'lower_is_better', label: '↓ Lower is better' }, { v: 'higher_is_better', label: '↑ Higher is better' }].map(d => (
                          <button key={d.v} onClick={() => setOpen({ ...open, itemDraft: { ...id, direction: d.v } })}
                            style={{ padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid', borderColor: id.direction === d.v ? '#6366f1' : '#d1d5db', background: id.direction === d.v ? '#eef2ff' : 'white', color: id.direction === d.v ? '#4f46e5' : '#374151', fontWeight: id.direction === d.v ? 600 : 400 }}
                          >{d.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {id.goalType === 'target_value' && (
                    <div>
                      <Label>Starting Value <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span></Label>
                      <Input type="number" style={{ width: 'auto' }} placeholder="Your value at the start" value={id.startingValue ?? ''} onChange={e => setOpen({ ...open, itemDraft: { ...id, startingValue: e.target.value !== '' ? Number(e.target.value) : null } })} />
                    </div>
                  )}
                  {id.goalType === 'range' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}><Label>Min</Label><Input type="number" style={{ width: 'auto' }} value={id.targetMin ?? ''} onChange={e => setOpen({ ...open, itemDraft: { ...id, targetMin: e.target.value !== '' ? Number(e.target.value) : null } })} /></div>
                      <div style={{ flex: 1 }}><Label>Max</Label><Input type="number" style={{ width: 'auto' }} value={id.targetMax ?? ''} onChange={e => setOpen({ ...open, itemDraft: { ...id, targetMax: e.target.value !== '' ? Number(e.target.value) : null } })} /></div>
                    </div>
                  )}
                  {id.goalType === 'streak' && (
                    <div>
                      <Label>Streak Target (consecutive days)</Label>
                      <Input type="number" style={{ width: 'auto' }} value={id.streakTarget ?? ''} onChange={e => setOpen({ ...open, itemDraft: { ...id, streakTarget: e.target.value !== '' ? Number(e.target.value) : null } })} />
                    </div>
                  )}
                  <div>
                    <Label>Period</Label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {PERIOD_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => setOpen({ ...open, itemDraft: { ...id, period: opt.value } })}
                          style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid', borderColor: id.period === opt.value ? '#6366f1' : '#d1d5db', background: id.period === opt.value ? '#eef2ff' : 'white', color: id.period === opt.value ? '#4f46e5' : '#374151', fontWeight: id.period === opt.value ? 600 : 400 }}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {id.period === 'rolling' && (
                      <div style={{ marginTop: 8 }}>
                        <Label>Rolling Window (days)</Label>
                        <Input type="number" style={{ width: 'auto' }} value={id.periodDays ?? ''}
                          onChange={e => setOpen({ ...open, itemDraft: { ...id, periodDays: e.target.value !== '' ? Number(e.target.value) : null } })} />
                      </div>
                    )}
                  </div>
                  {open.saveError && <div style={{ color: '#dc2626', fontSize: 13 }}>{open.saveError}</div>}
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setOpen({ ...open, screen: 'pick-metric', itemDraft: undefined, saveError: undefined })}>Back</Button>
                  <Button onClick={() => {
                    if (!id.goalName?.trim()) { setOpen({ ...open, saveError: 'Please enter a goal name.' }); return; }
                    if ((id.goalType === 'target_value' || id.goalType === 'cumulative') && id.targetValue == null) { setOpen({ ...open, saveError: 'Please enter a target value.' }); return; }
                    if (id.goalType === 'range' && (id.targetMin == null || id.targetMax == null)) { setOpen({ ...open, saveError: 'Please enter Min and Max values.' }); return; }
                    if (id.goalType === 'streak' && !id.streakTarget) { setOpen({ ...open, saveError: 'Please enter a streak target.' }); return; }
                    const newItems = [...items, id];
                    setOpen({ ...open, screen: 'items', draft: { ...draft, items: newItems }, itemDraft: undefined, saveError: undefined });
                  }}>Add to Program</Button>
                </DialogFooter>
              </DialogContent>
            );
          }

          return null;
        })()}
      </Dialog>
    </div>
  );
}
