import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, Moon, Brain, Bone, Edit, Pill, SlidersHorizontal, Settings, Plus, Clock, Thermometer, History, Download, Upload, User, Link } from "lucide-react";

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

export default function App() {

  /* --- Static metric definitions --
      This will be loaded from a config file or API
      They are the standard data points across all users
  */
  // User account info (would be loaded from a user table/service)
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { services: [], ...parsed };
      }
    } catch { }
    return {
      firstName: "Ray",
      lastName: "Steele",
      // Store DOB as ISO date string for easy binding to <input type="date">
      dob: "1959-10-21",
      services: [],
    };
  });

  const metricConfig = {
    weight: { title: "Weight", kind: "singleValue", uom: "lbs" },
    pain: { title: "Pain", kind: "slider", uom: "", prompt: "How bad is your pain today?" },
    back: { title: "Back Pain", kind: "slider", uom: "", prompt: "How bad is your back pain today?" },
    headache: { title: "Headache", kind: "slider", uom: "", prompt: "How bad is your headache today?" },
    tired: { title: "Tiredness", kind: "slider", uom: "", prompt: "How tired do you feel today?" },
    temperature: { title: "Temperature", kind: "singleValue", uom: "°F" },
    heart: { title: "Heart Rate", kind: "singleValue", uom: "bpm", prompt: "What is your Heart Rate (beats per minute)?" },
    systolic: { title: "BP - Systolic", kind: "singleValue", uom: "" },
    diastolic: { title: "BP - Diastolic", kind: "singleValue", uom: "" },
    glucose: { title: "Blood Glucose", kind: "singleValue", uom: "mg/dL", prompt: "What is your Blood Glucose (sugar) level?" },
    tylenol: { title: "Rx - Tylenol", kind: "switch", uom: "", prompt: "Did you take Tylenol within the last 4 hours?" },
    losartan: { title: "Rx - Losartan", kind: "switch", uom: "", prompt: "Did you take Losartan today?" }
  };

  /* --- Card definitions and active Cards ---
      Card Definitions (what each card contains)
      There will be a catalog of possible cards available in a database or API
      (for now, hardcode them here)

      Active Cards (which cards the specific user has chosen to show and in what order)
      A User's account will determine which cards are active
      In the app, a user can customize which cards are shown on their dashboard
      (e.g. by dragging and dropping them)
      When a user makes changes to their dashboard, those changes are saved to their account.

      If you have shared your account with a clinician, they may access your account to enable certain cards on your behalf 
      (how? via a shared link or direct access?) 

      Data Points (the actual values recorded for each metric)
      These will be loaded from a database or API
      Each User/Metric will have a time series of recorded values
      (for now, hardcode some sample data)
  */
  const cardDefinitions = [
    {
      cardName: "weight",
      title: "Weight",
      icon: Activity,
      metricNames: ["weight"]
    },
    {
      cardName: "symptoms",
      title: "Symptoms",
      icon: Activity,
      metricNames: ["pain", "temperature", "tylenol"]
    },
    {
      cardName: "heart",
      title: "Heart Rate",
      icon: Heart,
      metricNames: ["heart"]
    },
    {
      cardName: "temperature",
      title: "Temperature",
      icon: Thermometer,
      metricNames: ["temperature"]
    },
    {
      cardName: "blood-pressure",
      title: "Blood Pressure",
      icon: Activity,
      metricNames: ["systolic", "diastolic", "losartan"]
    },
    {
      cardName: "glucose",
      title: "Glucose",
      icon: Droplet,
      metricNames: ["glucose"]
    },
    {
      cardName: "tired",
      title: "Tired",
      icon: Moon,
      color: "#4f46e5",
      metricNames: ["tired"]
    },
    {
      cardName: "headache",
      title: "Headache",
      icon: Brain,
      color: "#7c3aed",
      metricNames: ["headache"]
    },
    {
      cardName: "back",
      title: "Back Ache",
      icon: Bone,
      color: "#f59e0b",
      metricNames: ["back"]
    },
    {
      cardName: "tylenol",
      title: "Tylenol",
      icon: Pill,
      color: "#10b981",
      metricNames: ["tylenol"]
    },
    {
      cardName: "losartan",
      title: "Losartan",
      icon: Pill,
      color: "#10b981",
      metricNames: ["losartan"]
    },
  ];

  const [activeCards, setActiveCards] = useState(() => {
    // On load, try to get preferred ordered list of active cards from localStorage
    // If that fails, then read the User's account where we store which cards are active and what order they are in
    try {
      const raw = localStorage.getItem("activeCards");
      if (raw) return JSON.parse(raw);
    } catch { }
    // Default: everything active in current order
    return cardDefinitions.map(c => c.cardName);
  });

  const [records, setRecords] = useState(() => {
    // Helper to build data point structure from entries: [{ts, value, updatedAt, source}]
    const make = (arr) => {
      const dayValue = {};
      arr.forEach((e) => { dayValue[String(e.ts)] = { value: e.value, updatedAt: e.updatedAt, source: e.source }; });
      return { entries: arr, dayValue };
    };
    return {
      dataPoints: {
        // Weight: one reading per morning across days
        weight: make([
          { ts: new Date("2025-11-01T07:30:00").getTime(), value: 173, updatedAt: new Date("2025-11-01T07:31:00").toISOString(), source: "Fitbit" },
          { ts: new Date("2025-11-02T07:40:00").getTime(), value: 172.5, updatedAt: new Date("2025-11-02T07:41:00").toISOString(), source: "Withings Scale" },
        ]),
        // Heart rate: multiple readings throughout the day
        heart: make([
          { ts: new Date("2025-11-01T08:20:00").getTime(), value: 78, updatedAt: new Date("2025-11-01T08:21:00").toISOString(), source: "Apple Health" },
          { ts: new Date("2025-11-02T08:10:00").getTime(), value: 76, updatedAt: new Date("2025-11-02T08:12:00").toISOString(), source: "Apple Health" },
          { ts: new Date("2025-11-02T12:05:00").getTime(), value: 82, updatedAt: new Date("2025-11-02T12:06:00").toISOString(), source: "Fitbit" },
          { ts: new Date("2025-11-02T19:20:00").getTime(), value: 74, updatedAt: new Date("2025-11-02T19:22:00").toISOString(), source: "manual entry" },
        ]),
        // Glucose: morning fasting
        glucose: make([
          { ts: new Date("2025-11-01T07:45:00").getTime(), value: 110, updatedAt: new Date("2025-11-01T07:46:00").toISOString(), source: "Dexcom" },
          { ts: new Date("2025-11-02T07:50:00").getTime(), value: 102, updatedAt: new Date("2025-11-02T07:51:00").toISOString(), source: "Dexcom" },
        ]),
        // Blood pressure: multiple times per day
        systolic: make([
          { ts: new Date("2025-11-01T09:00:00").getTime(), value: 130, updatedAt: new Date("2025-11-01T09:02:00").toISOString(), source: "manual entry" },
          { ts: new Date("2025-11-02T08:30:00").getTime(), value: 120, updatedAt: new Date("2025-11-02T08:31:00").toISOString(), source: "Omron Connect" },
          { ts: new Date("2025-11-02T12:30:00").getTime(), value: 126, updatedAt: new Date("2025-11-02T12:31:00").toISOString(), source: "Apple Health" },
          { ts: new Date("2025-11-02T20:10:00").getTime(), value: 118, updatedAt: new Date("2025-11-02T20:12:00").toISOString(), source: "manual entry" },
        ]),
        diastolic: make([
          { ts: new Date("2025-11-01T09:00:00").getTime(), value: 85, updatedAt: new Date("2025-11-01T09:02:00").toISOString(), source: "manual entry" },
          { ts: new Date("2025-11-02T08:30:00").getTime(), value: 80, updatedAt: new Date("2025-11-02T08:31:00").toISOString(), source: "Omron Connect" },
          { ts: new Date("2025-11-02T12:30:00").getTime(), value: 84, updatedAt: new Date("2025-11-02T12:31:00").toISOString(), source: "Apple Health" },
          { ts: new Date("2025-11-02T20:10:00").getTime(), value: 78, updatedAt: new Date("2025-11-02T20:12:00").toISOString(), source: "manual entry" },
        ]),
        // Symptom sliders
        tired: make([
          { ts: new Date("2025-11-01T21:00:00").getTime(), value: 6, updatedAt: new Date("2025-11-01T21:01:00").toISOString(), source: "manual entry" },
          { ts: new Date("2025-11-02T21:05:00").getTime(), value: 5, updatedAt: new Date("2025-11-02T21:06:00").toISOString(), source: "manual entry" },
        ]),
        headache: make([
          { ts: new Date("2025-11-01T16:00:00").getTime(), value: 2, updatedAt: new Date("2025-11-01T16:02:00").toISOString(), source: "manual entry" },
        ]),
        back: make([
          { ts: new Date("2025-11-02T18:30:00").getTime(), value: 3, updatedAt: new Date("2025-11-02T18:31:00").toISOString(), source: "manual entry" },
        ]),
        // Medication switches
        tylenol: make([
          { ts: new Date("2025-11-02T10:00:00").getTime(), value: true, updatedAt: new Date("2025-11-02T10:01:00").toISOString(), source: "manual entry" },
        ]),
        losartan: make([
          { ts: new Date("2025-11-02T08:00:00").getTime(), value: true, updatedAt: new Date("2025-11-02T08:01:00").toISOString(), source: "manual entry" },
        ]),
      },
    };
  });

  // --- Selected day ----------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const calendarButtonRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Update metric values in the records (timestamped entries)
  // newData: { metric, inputValue, ts, editTs, source }
  // In production, this would also update the backend database for this user
  const updateDayValues = (newData) => {
    setRecords((prev) => {
      const metricKey = newData.metric;
      const dp = prev.dataPoints[metricKey] ?? {};
      let entries = Array.isArray(dp.entries) ? [...dp.entries] : [];
      const ts = typeof newData.ts === 'number' ? newData.ts : Date.now();
      const updatedAt = new Date().toISOString();
      const source = newData.source || "manual entry"; // Default to manual entry if not specified

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

  // --- Feature flags (persisted) --------------------------------------------
  // In a real app, feature flags would typically come from the user's account
  // (e.g., fetched from your backend after auth) to control access like paid tiers
  // or experimental features. Here we scaffold a local persisted object and keep it
  // in localStorage for the demo.
  const [featureFlags, setFeatureFlags] = useState(() => {
    try {
      const raw = localStorage.getItem("featureFlags");
      if (raw) {
        const parsed = JSON.parse(raw);
        return { paidVersion: false, ...parsed };
      }
    } catch { }
    return { paidVersion: false };
  });

  // --- View mode ------------------------------------------------------------
  // 'day' = show all cards for selected date
  // 'metric-history' = show all entries for a specific metric across dates
  // 'latest' = show all cards with their most recent data regardless of date
  const [viewMode, setViewMode] = useState('day');
  const defaultHistoryMetric = 'weight';
  const [historyMetric, setHistoryMetric] = useState(defaultHistoryMetric);

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

  // Current date/time label (for left header area)
  const nowText = useMemo(() =>
    new Date().toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    []
  );

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

  return (
    <div style={{ padding: 24 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header / Date Picker */}
      {/* Get greeting based on time of day */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", marginBottom: 8 }}>
        {/* Left: greeting + current date/time */}
        <div style={{ justifySelf: "start" }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 2px 0" }}>{getGreeting()}, {user.firstName}</h1>
          <div className="header-date">{nowText}</div>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifySelf: "end" }}>
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
          {/* history view */}
          <Button
            variant="outline"
            className={`btn-icon btn-mode ${viewMode === 'metric-history' ? 'btn-mode-active' : ''}`}
            aria-label="History view"
            title="History view"
            onClick={() => setViewMode('metric-history')}
          >
            <History />
          </Button>
          {/* selectors next to active modes */}
          {viewMode === 'metric-history' && (
            <select
              className="mode-select"
              aria-label="Choose metric"
              value={historyMetric}
              onChange={(e) => setHistoryMetric(e.target.value)}
            >
              {Object.keys(metricConfig).map((m) => (
                <option key={m} value={m}>{metricConfig[m].title || toSentenceCase(m)}</option>
              ))}
            </select>
          )}
          {/* latest view */}
          <Button
            variant="outline"
            className={`btn-icon btn-mode ${viewMode === 'latest' ? 'btn-mode-active' : ''}`}
            aria-label="Latest view"
            title="Latest view"
            onClick={() => setViewMode('latest')}
          >
            <Clock />
          </Button>
          {/* vertical separator between mode buttons and settings */}
          <div className="actions-sep" />
          {/* settings menu button */}
          <Button
            ref={settingsButtonRef}
            variant="outline"
            className="btn-icon"
            aria-label="Settings menu"
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          >
            <Settings />
          </Button>
          {/* swipe left/right on the screen to change dates */}
        </div>
      </div>

      {/* Settings menu popup */}
      {showSettingsMenu && (
        <>
          <div
            className="calendar-popup-overlay"
            onClick={() => setShowSettingsMenu(false)}
          />
          <div className="settings-menu-popup">
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "profile", tempUser: { ...user } });
              }}
            >
              <User size={18} />
              <span>Profile</span>
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
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "configure", tempActive: [...activeCards], tempFlags: { ...featureFlags } });
              }}
            >
              <SlidersHorizontal size={18} />
              <span>Customize Dashboard</span>
            </button>
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "import" });
              }}
            >
              <Upload size={18} />
              <span>Import Data</span>
            </button>
            <button
              className="settings-menu-item"
              onClick={() => {
                setShowSettingsMenu(false);
                setOpen({ type: "export" });
              }}
            >
              <Download size={18} />
              <span>Export Data</span>
            </button>
          </div>
        </>
      )}

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

      {/* Centered header label */}
      <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 600, margin: '24px 0 20px' }}>
        {viewMode === 'day' && (
          <span>Data for {niceDate}</span>
        )}
        {viewMode === 'metric-history' && (
          <span>History: {metricConfig[historyMetric]?.title || toSentenceCase(historyMetric)}</span>
        )}
        {viewMode === 'latest' && (
          <span>Most recent entries</span>
        )}
      </div>

      {/* Main content */}
      {viewMode !== 'metric-history' ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 320px))", gap: 12, justifyContent: "center" }}>
          {(() => {
            const points = records.dataPoints ?? {};
            // Render only active cards, in the chosen order
            return activeCards
              .map((name) => cardDefinitions.find((c) => c.cardName === name))
              .filter(Boolean)
              .map((meta) => {
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
                  } else {
                    // latest mode: use the most recent entry overall
                    if (entries.length > 0) {
                      lastEntry = entries[entries.length - 1];
                    } else if (data.dayValue) {
                      // Fallback to legacy map: pick the latest key
                      const keys = Object.keys(data.dayValue);
                      keys.sort((a, b) => {
                        const pa = Date.parse(a) || Number(a) || 0;
                        const pb = Date.parse(b) || Number(b) || 0;
                        return pa - pb;
                      });
                      const k = keys[keys.length - 1];
                      if (k) {
                        const rec = data.dayValue[k];
                        const tsK = Number(k) || Date.parse(k.length === 10 ? `${k}T00:00:00` : k);
                        lastEntry = { ts: tsK, value: rec?.value ?? null, updatedAt: rec?.updatedAt, source: rec?.source };
                      }
                    }
                    // In latest mode, count total entries
                    entryCount = entries.length;
                  }
                  const value = lastEntry ? lastEntry.value : (viewMode === 'day' ? fallbackValue : null);
                  const timestamp = lastEntry ? lastEntry.ts : null;
                  const source = lastEntry ? lastEntry.source : null;
                  const updatedAt = lastEntry ? (lastEntry.updatedAt ?? new Date().toISOString()) : (viewMode === 'day' ? fallbackUpdated : null);
                  return { metric: metricName, ...config, value, timestamp, source, updatedAt, entryCount };
                });
                const hasValue = metricValues.some(mv => mv.value !== null && mv.value !== undefined);
                const Icon = meta.icon ?? Activity;
                const color = meta.color ?? (meta.metricNames.some(name => metricConfig[name].kind === "slider") ? "#4f46e5" : "#16a34a");

                // Use the first timestamp for display; count total entries for badge
                const displayTimestamp = metricValues.find(v => v.timestamp)?.timestamp;
                const totalEntries = metricValues.reduce((sum, mv) => sum + (mv.entryCount || 0), 0);

                // Collect unique sources (excluding "manual entry")
                const sources = [...new Set(metricValues.map(mv => mv.source).filter(s => s && s !== "manual entry"))];

                return (
                  <Card key={meta.cardName}>
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
                              {displayTimestamp ? (viewMode === 'latest' ? fmtDateTime(new Date(displayTimestamp)) : fmtTime(new Date(displayTimestamp))) : "—"}
                              {totalEntries > 1 && viewMode !== 'latest' && (meta.metricNames?.length === 1) && (
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
                          </>
                        ) : (
                          <p className="card-updated">No data yet</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              });
          })()}
        </div>
      ) : (
        // Metric history view
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 8px' }}>
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
              const cfg = metricConfig[historyMetric] || {};
              const title = cfg.title || cfg.prompt || toSentenceCase(historyMetric);
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
                        const cfg = metricConfig[historyMetric] || {};
                        const title = cfg.title || cfg.prompt || toSentenceCase(historyMetric);
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
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {formatValue(e.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

        {/* Configure visible cards (drag & drop) */}
        {open?.type === "configure" && (
          <DialogContent>
            <DialogHeader style={{ textAlign: "center", marginBottom: 16 }}>
              <DialogTitle>{user.firstName}'s dashboard</DialogTitle>
            </DialogHeader>
            {(() => {
              const tempActive = open?.tempActive ?? [];
              const available = cardDefinitions
                .filter(c => !tempActive.includes(c.cardName))
                .slice()
                .sort((a, b) => a.title.localeCompare(b.title));

              const onDropToActive = (e) => {
                e.preventDefault();
                let data;
                try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { data = null; }
                if (!data || !data.name) return;
                if (!tempActive.includes(data.name)) {
                  setOpen({ ...open, tempActive: [...tempActive, data.name] });
                }
              };
              const onDropToAvailable = (e) => {
                e.preventDefault();
                let data;
                try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { data = null; }
                if (!data || !data.name) return;
                if (tempActive.includes(data.name)) {
                  setOpen({ ...open, tempActive: tempActive.filter(n => n !== data.name) });
                }
              };

              const insertIntoActiveAt = (name, targetIndex) => {
                const current = [...tempActive];
                const existingIdx = current.indexOf(name);
                // remove if already present
                if (existingIdx !== -1) {
                  current.splice(existingIdx, 1);
                  // if removed index is before target, shift target left
                  if (existingIdx < targetIndex) targetIndex = Math.max(0, targetIndex - 1);
                }
                // clamp target
                if (targetIndex < 0) targetIndex = 0;
                if (targetIndex > current.length) targetIndex = current.length;
                // insert
                current.splice(targetIndex, 0, name);
                setOpen({ ...open, tempActive: current, tempOverIndex: undefined, tempOverList: undefined });
              };

              const draggableItem = (c, from, index) => {
                const Icon = c.icon ?? Activity;
                const iconColor = c.color ?? (c.metricNames.some(name => metricConfig[name].kind === "slider") ? "#4f46e5" : "#16a34a");
                return (
                  <li
                    key={c.cardName}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', JSON.stringify({ name: c.cardName, from }));
                    }}
                    className="dnd-item"
                    aria-label={`${c.title} card`}
                    onDragOver={(e) => {
                      if (from === 'active' && typeof index === 'number') {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (open?.tempOverIndex !== index || open?.tempOverList !== 'active') {
                          setOpen({ ...open, tempOverIndex: index, tempOverList: 'active' });
                        }
                      }
                    }}
                    onDragLeave={() => {
                      if (open?.tempOverIndex === index && open?.tempOverList === 'active') {
                        setOpen({ ...open, tempOverIndex: undefined, tempOverList: undefined });
                      }
                    }}
                    onDrop={(e) => {
                      if (typeof index !== 'number') return;
                      e.preventDefault();
                      let data;
                      try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { data = null; }
                      if (!data || !data.name) return;
                      insertIntoActiveAt(data.name, index);
                    }}
                  >
                    <Icon style={{ width: 16, height: 16, color: iconColor }} className="dnd-icon" />
                    <span className="dnd-title">{c.title}</span>
                  </li>
                );
              };

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '8px 0 0 0' }}>
                  <div className="dnd-column">
                    <div className="dnd-column-title">Available cards</div>
                    <ul
                      className="dnd-list"
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={onDropToAvailable}
                    >
                      {available.length === 0 ? (
                        <li className="dnd-empty">No available cards</li>
                      ) : (
                        available.map(c => draggableItem(c, 'available'))
                      )}
                    </ul>
                  </div>
                  <div className="dnd-column">
                    <div className="dnd-column-title">Active cards</div>
                    <ul
                      className="dnd-list"
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={onDropToActive}
                    >
                      {tempActive.length === 0 ? (
                        <li className="dnd-empty">Drag cards here</li>
                      ) : (
                        tempActive.map((name, index) => {
                          const c = cardDefinitions.find(cd => cd.cardName === name);
                          const isInsertBefore = open?.tempOverList === 'active' && open?.tempOverIndex === index;
                          return c ? (
                            <div key={c.cardName} style={{ position: 'relative' }}>
                              {isInsertBefore && (
                                <div style={{
                                  position: 'absolute',
                                  top: -4,
                                  left: 0,
                                  right: 0,
                                  height: 0,
                                  borderTop: '2px solid #2563eb'
                                }} />
                              )}
                              {draggableItem(c, 'active', index)}
                            </div>
                          ) : null;
                        })
                      )}
                    </ul>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => {
                const nextActive = [...(open?.tempActive ?? [])];
                setActiveCards(nextActive);
                try { localStorage.setItem('activeCards', JSON.stringify(nextActive)); } catch { }
                setOpen(null);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Profile: Edit user information */}
        {open?.type === "profile" && (
          <DialogContent>
            <DialogHeader style={{ textAlign: "center", marginBottom: 16 }}>
              <DialogTitle>Profile</DialogTitle>
            </DialogHeader>
            <div style={{ display: 'grid', gap: 12, minWidth: 280 }}>
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  value={open?.tempUser?.firstName ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, firstName: e.target.value } })}
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="off"
                  data-lpignore="true"
                  value={open?.tempUser?.lastName ?? ""}
                  onChange={(e) => setOpen({ ...open, tempUser: { ...open.tempUser, lastName: e.target.value } })}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Button
                    type="button"
                    variant="outline"
                    className="btn-icon"
                    aria-label="Select date of birth"
                    data-lpignore="true"
                    onClick={() => {
                      const el = document.getElementById('dob');
                      if (el) {
                        if (typeof el.showPicker === 'function') {
                          // @ts-ignore - showPicker is not in older TS DOM libs
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
                  />
                </div>
              </div>
            </div>
            <DialogFooter style={{ justifyContent: 'center', marginTop: 28 }}>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => {
                const next = { ...(open?.tempUser ?? user) };
                setUser(next);
                try { localStorage.setItem('user', JSON.stringify(next)); } catch { }
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
                  return (
                    <div key={metricName} style={{ marginBottom: 16 }}>
                      <Label htmlFor={metricName}>{promptText}</Label>
                      <div style={{ maxWidth: 320 }}>
                        <Slider
                          id={metricName}
                          value={[open.metricValues?.[idx]?.value ?? 0]}
                          min={0}
                          max={10}
                          step={1}
                          onValueChange={(v) => {
                            const updatedValues = [...(open.metricValues ?? [])];
                            updatedValues[idx] = { ...updatedValues[idx], value: v[0] };
                            setOpen({ ...open, metricValues: updatedValues });
                          }}
                        />
                        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                          <span>0 • Good</span>
                          <span style={{ fontSize: '24px', fontWeight: 600, color: "#222", margin: "0 12px" }}>
                            {open.metricValues?.[idx]?.value ?? 0}
                          </span>
                          <span>10 • Awful</span>
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
                          const newValue = e.target.value ? Number(e.target.value) : null;
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
                      updateDayValues({
                        metric: metricName,
                        inputValue: open.metricValues?.[idx]?.value,
                        ts,
                        editTs: open.editEntryTs,
                      });
                    });
                  } else {
                    // Add new entry (collision check already handled above with confirmation)
                    open.metricNames.forEach((metricName, idx) => {
                      updateDayValues({ metric: metricName, inputValue: open.metricValues?.[idx]?.value, ts });
                    });
                  }
                  setOpen(null);
                }}>Save</Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
