import React, { useMemo, useRef, useState } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, Moon, Brain, Bone, Edit, Pill, SlidersHorizontal, Settings, Plus, Clock } from "lucide-react";

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
import { toKey, fmtTime, toSentenceCase } from "./utils/helpers";

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
    weight: { kind: "singleValue", uom: "lbs" },
    pain: { kind: "slider", uom: "", prompt: "How bad is your pain today?" },
    back: { kind: "slider", uom: "", prompt: "How bad is your back pain today?" },
    headache: { kind: "slider", uom: "", prompt: "How bad is your headache today?" },
    temperature: { kind: "singleValue", uom: "°F" },
    heart: { kind: "singleValue", uom: "bpm", prompt: "What is your Heart Rate (beats per minute)?" },
    systolic: { kind: "singleValue", uom: "" },
    diastolic: { kind: "singleValue", uom: "" },
    glucose: { kind: "singleValue", uom: "mg/dL", prompt: "What is your Blood Glucose (sugar) level?" },
    tylenol: { kind: "switch", uom: "", prompt: "Did you take Tylenol within the last 4 hours?" },
    losartan: { kind: "switch", uom: "", prompt: "Did you take Losartan today?" }
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
    const todayKey = toKey(new Date());
    return {
      dataPoints: {
        "weight": {
          dayValue: {
            [todayKey]: { value: 172, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 174, updatedAt: new Date("2025-08-15T09:10:00").toISOString() }
          }
        },
        "heart": {
          dayValue: {
            [todayKey]: { value: 76, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 88, updatedAt: new Date("2025-08-15T08:15:00").toISOString() }
          }
        },
        "glucose": {
          dayValue: {
            [todayKey]: { value: 102, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 110, updatedAt: new Date("2025-08-15T08:05:00").toISOString() }
          }
        },
        "systolic": {
          dayValue: {
            [todayKey]: { value: 120, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 130, updatedAt: new Date("2025-08-15T09:10:00").toISOString() }
          }
        },
        "diastolic": {
          dayValue: {
            [todayKey]: { value: 80, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 110, updatedAt: new Date("2025-08-15T09:10:00").toISOString() }
          }
        },
        "tired": {
          dayValue: {}
        },
        "headache": {
          dayValue: {}
        },
        "back": {
          dayValue: {}
        },
      },
    };
  });

  // --- Selected day ----------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);

  // Update metric values in the records (timestamped entries)
  // newData: { metric, inputValue, ts }
  const updateDayValues = (newData) => {
    setRecords((prev) => {
      const metricKey = newData.metric;
      const dp = prev.dataPoints[metricKey] ?? {};
      const entries = Array.isArray(dp.entries) ? [...dp.entries] : [];
      const ts = typeof newData.ts === 'number' ? newData.ts : Date.now();
      entries.push({ ts, value: newData.inputValue });
      entries.sort((a, b) => a.ts - b.ts);
      const updatedDataPoints = {
        ...prev.dataPoints,
        [metricKey]: {
          ...dp,
          entries,
          // keep any legacy dayValue for backward-compat
          dayValue: dp.dayValue ?? {}
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
          <Button variant="outline" className="btn-icon" aria-label="Select date" onClick={() => setOpen({ type: "date" })}>
            <CalendarDays />
          </Button>
          {/* customize dashboard */}
          <Button
            variant="outline"
            className="btn-icon"
            aria-label="Customize dashboard"
            onClick={() => setOpen({ type: "configure", tempActive: [...activeCards], tempFlags: { ...featureFlags } })}
          >
            <SlidersHorizontal />
          </Button>
          {/* settings (user information) */}
          <Button
            variant="outline"
            className="btn-icon"
            aria-label="Settings"
            onClick={() => setOpen({ type: "settings", tempUser: { ...user } })}
          >
            <Settings />
          </Button>
          {/* swipe left/right on the screen to change dates */}
        </div>
      </div>

      {/* Viewing selected day label below header and above cards */}
      <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 600, margin: '4px 0 32px' }}>
        Viewing {niceDate}
      </div>

      {/* Cards grid */}
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
                // Look for the most recent entry for the selected day
                const entries = Array.isArray(data.entries) ? data.entries : [];
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const startMs = dayStart.getTime();
                const endMs = startMs + 24 * 60 * 60 * 1000;
                let lastEntry = null;
                for (let i = entries.length - 1; i >= 0; i--) {
                  const e = entries[i];
                  if (e.ts >= startMs && e.ts < endMs) { lastEntry = e; break; }
                }
                const value = lastEntry ? lastEntry.value : (data.dayValue && data.dayValue[selectedKey]?.value) ?? fallbackValue;
                const updatedAt = lastEntry ? new Date(lastEntry.ts).toISOString() : (data.dayValue && data.dayValue[selectedKey]?.updatedAt) ?? fallbackUpdated;
                return { metric: metricName, ...config, value, updatedAt };
              });
              const hasValue = metricValues.some(mv => mv.value !== null && mv.value !== undefined);
              const Icon = meta.icon ?? Activity;
              const color = meta.color ?? (meta.metricNames.some(name => metricConfig[name].kind === "slider") ? "#4f46e5" : "#16a34a");

              // Use the first updatedAt for display
              const updatedAt = metricValues.find(v => v.updatedAt)?.updatedAt;

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
                        setOpen({
                          type: meta.cardName,
                          ...meta,
                          metricValues,
                          tempEntryDate: toIsoDate(selectedDate),
                          tempEntryTime: defaultTime,
                        });
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
                          <p className="card-updated">Updated {fmtTime(updatedAt ? new Date(updatedAt) : null) ?? "—"}</p>
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
              <Button onClick={() => setOpen(null)}>Use this date</Button>
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

        {/* Settings: Edit user information */}
        {open?.type === "settings" && (
          <DialogContent>
            <DialogHeader style={{ textAlign: "center", marginBottom: 16 }}>
              <DialogTitle>Settings</DialogTitle>
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

              {/* Connected services */}
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
              {/* end services */}
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

        {/* Single Value Metrics */}
        {open?.metricNames && (
          <DialogContent className="narrow-dialog">
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
            </DialogHeader>
            <div>
              {open.metricNames.map((metricName, idx) => {
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
            {/* Timestamp controls moved to bottom above actions for cleaner layout */}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 16, paddingTop: 12 }}>
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

            <DialogFooter style={{ justifyContent: 'center', marginTop: 20 }}>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => {
                // Build timestamp based on chosen date/time
                let ts = Date.now();
                try {
                  const dateStr = open?.tempEntryDate; // YYYY-MM-DD
                  const timeStr = open?.tempEntryTime || '09:00'; // HH:MM
                  if (dateStr) {
                    const d = new Date(`${dateStr}T${timeStr}:00`);
                    if (!isNaN(d.getTime())) ts = d.getTime();
                  }
                } catch { }
                open.metricNames.forEach((metricName, idx) => {
                  updateDayValues({ metric: metricName, inputValue: open.metricValues?.[idx]?.value, ts });
                });
                setOpen(null);
              }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
