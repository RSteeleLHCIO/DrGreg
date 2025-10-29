import React, { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, ChevronLeft, ChevronRight, LineChart as LineChartIcon, Moon, Brain, Bone, Edit, Pill } from "lucide-react";
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
import { Switch } from "./components/ui/switch";
const ChartModal = lazy(() => import("./components/chart-modal"));

// Helper to format a Date as YYYY-MM-DD (key for our records map)
function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(d) {
  if (!d) return null;
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return null;
  }
}

export default function App() {
  // --- Per-day records store -------------------------------------------------
  const [records, setRecords] = useState(() => {
    const todayKey = toKey(new Date());
    return {
      dataPoints: {
        "weight": {
          title: "Weight", uom: "lbs", field: "weight", icon: Activity, kind: "singleValue", dayValue: {
            [todayKey]: { value: 172, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 174, updatedAt: new Date("2025-08-15T09:10:00").toISOString() }
          }
        },
        "heart": {
          title: "Heart Rate", uom: "bpm", field: "heartRate", icon: Heart, kind: "singleValue", dayValue: {
            [todayKey]: { value: 76, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 88, updatedAt: new Date("2025-08-15T08:15:00").toISOString() }
          }
        },
        "glucose": {
          title: "Glucose", uom: "mg/dL", field: "glucose", icon: Droplet, kind: "singleValue", dayValue: {
            [todayKey]: { value: 102, updatedAt: new Date().toISOString() },
            "2025-08-15": { value: 110, updatedAt: new Date("2025-08-15T08:05:00").toISOString() }
          }
        },
        "tired": {
          title: "Tired", uom: "/10", field: "tired", type: "scale", icon: Moon, color: "#4f46e5", kind: "slider", dayValue: {}
        },
        "headache": {
          title: "Headache", uom: "/10", field: "headache", type: "scale", icon: Brain, color: "#7c3aed", kind: "slider", dayValue: {}
        },
        "back": {
          title: "Back Ache", uom: "/10", field: "backAche", type: "scale", icon: Bone, color: "#f59e0b", kind: "slider", dayValue: {}
        },
      },
      [todayKey]: {
        weight: 172,
        weightUpdatedAt: new Date().toISOString(),
        glucose: 102,
        glucoseUpdatedAt: new Date().toISOString(),
        heartRate: 76,
        heartUpdatedAt: new Date().toISOString(),
        bpSystolic: 122,
        bpDiastolic: 78,
        bpUpdatedAt: new Date().toISOString(),
        tired: 3,
        tiredUpdatedAt: new Date().toISOString(),
        headache: 1,
        headacheUpdatedAt: new Date().toISOString(),
        backAche: 2,
        backAcheUpdatedAt: new Date().toISOString(),
        losartan: false,
        losartanUpdatedAt: new Date().toISOString(),
      },
      // Example: a past day with different values (for demo)
      "2025-08-15": {
        weight: 174,
        weightUpdatedAt: new Date("2025-08-15T09:10:00").toISOString(),
        glucose: 110,
        glucoseUpdatedAt: new Date("2025-08-15T08:05:00").toISOString(),
        heartRate: 88,
        heartUpdatedAt: new Date("2025-08-15T08:15:00").toISOString(),
        bpSystolic: 124,
        bpDiastolic: 78,
        bpUpdatedAt: new Date("2025-08-15T08:20:00").toISOString(),
        tired: 5,
        tiredUpdatedAt: new Date("2025-08-15T07:40:00").toISOString(),
        headache: 2,
        headacheUpdatedAt: new Date("2025-08-15T07:50:00").toISOString(),
        backAche: 4,
        backAcheUpdatedAt: new Date("2025-08-15T07:55:00").toISOString(),
      },
    };
  });

  // --- Selected day ----------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);

  // Extract values for the selected day (fallback to nulls)
  const [dayValues, setDayValues] = useState(records[selectedKey] ?? {
    weight: null,
    weightUpdatedAt: null,
    glucose: null,
    glucoseUpdatedAt: null,
    heartRate: null,
    heartUpdatedAt: null,
    bpSystolic: null,
    bpDiastolic: null,
    bpUpdatedAt: null,
    tired: null,
    tiredUpdatedAt: null,
    headache: null,
    headacheUpdatedAt: null,
    backAche: null,
    backAcheUpdatedAt: null,
  });

  // Local state mirrors for inputs (so dialogs edit the selected day)
  const updateDayValues = (newData) => {
    records.dataPoints[newData.metric].dayValue[selectedKey] ??= {}; 
    records.dataPoints[newData.metric].dayValue[selectedKey] = { value: newData.inputValue, updatedAt: new Date().toISOString() };
    setRecords(records);
  };

  const [inputValue, setInputValue] = useState(null);
  const [weight, setWeight] = useState(dayValues.weight);
  const [glucose, setGlucose] = useState(dayValues.glucose);
  const [heartRate, setHeartRate] = useState(dayValues.heartRate);
  const [bpSystolic, setBpSystolic] = useState(dayValues.bpSystolic);
  const [bpDiastolic, setBpDiastolic] = useState(dayValues.bpDiastolic);
  const [tired, setTired] = useState(dayValues.tired);
  const [headache, setHeadache] = useState(dayValues.headache);
  const [backAche, setBackAche] = useState(dayValues.backAche);
  const [losartan, setLosartan] = useState(dayValues.losartan);

  // Sync local card values whenever the selected date changes
  useEffect(() => {
    const v = records[selectedKey] ?? {
      weight: null,
      weightUpdatedAt: null,
      glucose: null,
      glucoseUpdatedAt: null,
      heartRate: null,
      heartUpdatedAt: null,
      bpSystolic: null,
      bpDiastolic: null,
      bpUpdatedAt: null,
      tired: null,
      tiredUpdatedAt: null,
      headache: null,
      headacheUpdatedAt: null,
      backAche: null,
      backAcheUpdatedAt: null,
    };
    setWeight(v.weight);
    setGlucose(v.glucose);
    setHeartRate(v.heartRate);
    setBpSystolic(v.bpSystolic);
    setBpDiastolic(v.bpDiastolic);
    setTired(v.tired);
    setHeadache(v.headache);
    setBackAche(v.backAche);
    setLosartan(v.losartan);
  }, [records, selectedKey]);

  // --- Dialog state ----------------------------------------------------------
  const [open, setOpen] = useState(null);

  // Save helpers write into the records map for the selected day
  function upsertSelectedDay(update) {
    setRecords((prev) => {
      const current = prev[selectedKey] ?? {
        weight: null,
        weightUpdatedAt: null,
        glucose: null,
        glucoseUpdatedAt: null,
        heartRate: null,
        heartUpdatedAt: null,
        bpSystolic: null,
        bpDiastolic: null,
        bpUpdatedAt: null,
        tired: null,
        tiredUpdatedAt: null,
        headache: null,
        headacheUpdatedAt: null,
        backAche: null,
        backAcheUpdatedAt: null,
      };
      return { ...prev, [selectedKey]: { ...current, ...update } };
    });
  }

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

  // Build modifiers for the calendar (days with data get a dot)
  const daysWithData = useMemo(() => {
    return Object.entries(records)
      .filter(([, v]) =>
        v.weight !== null ||
        v.glucose !== null ||
        v.heartRate !== null ||
        (v.bpSystolic !== null && v.bpDiastolic !== null) ||
        v.tired !== null ||
        v.headache !== null ||
        v.backAche !== null
      )
      .map(([k]) => new Date(k + "T00:00:00"));
  }, [records]);

  const modifiers = {
    hasData: daysWithData,
  };

  const modifiersClassNames = {
    hasData:
      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-blue-500",
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Chart helpers: build last-14-days series for a metric -----------------
  function buildSeries(metric, anchor) {
    const data = [];
    const d = new Date(anchor);
    for (let i = 13; i >= 0; i--) {
      const itemDate = new Date(d);
      itemDate.setDate(d.getDate() - i);
      const key = toKey(itemDate);
      const rec = records[key];
      const label = itemDate.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
      if (!rec) {
        data.push({ date: label, value: null, sys: null, dia: null });
        continue;
      }
      if (metric === "weight") data.push({ date: label, value: rec.weight ?? null });
      else if (metric === "glucose") data.push({ date: label, value: rec.glucose ?? null });
      else if (metric === "heart") data.push({ date: label, value: rec.heartRate ?? null });
      else if (metric === "tired") data.push({ date: label, value: rec.tired ?? null });
      else if (metric === "headache") data.push({ date: label, value: rec.headache ?? null });
      else if (metric === "back") data.push({ date: label, value: rec.backAche ?? null });
      else if (metric === "bp") data.push({ date: label, sys: rec.bpSystolic ?? null, dia: rec.bpDiastolic ?? null });
    }
    return data;
  }

  const chartTitle = (m) =>
    m === "weight"
      ? "Weight (last 14 days)"
      : m === "glucose"
        ? "Glucose (last 14 days)"
        : m === "heart"
          ? "Heart Rate (last 14 days)"
          : m === "bp"
            ? "Blood Pressure (last 14 days)"
            : m === "tired"
              ? "Tired (0–10, last 14 days)"
              : m === "headache"
                ? "Headache (0–10, last 14 days)"
                : "Back Ache (0–10, last 14 days)";

  const getGreeting = () => {
    const hour = new Date().getHours();
    return hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header / Date Picker */}
      {/* Get greeting based on time of day */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 2px 0" }}>{getGreeting()}, Ray</h1>
          <div className="header-date">{niceDate}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="ghost" onClick={prevDay} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          {/* icon-only date picker */}
          <Button variant="outline" className="btn-icon" aria-label="Select date" onClick={() => setOpen({ type: "date" })}>
            <CalendarDays />
          </Button>
          {/* Hide forward caret when selected date is today */}
          {selectedKey !== toKey(today) && (
            <Button variant="ghost" onClick={nextDay} aria-label="Next day">
              <ChevronRight />
            </Button>
          )}
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {(() => {
          const dataPoints = records.dataPoints ?? {};
          return Object.keys(dataPoints).map((metric) => {
            const meta = dataPoints[metric] ?? {};
            // fallback to per-day record field if metadata dayValue is not populated
            const fallbackValue = records[selectedKey]?.[meta.field] ?? null;
            const fallbackUpdated = records[selectedKey]?.[`${meta.field}UpdatedAt`] ?? null;
            const dp = (meta.dayValue && meta.dayValue[selectedKey]) ?? { value: fallbackValue, updatedAt: fallbackUpdated };
            const hasValue = dp.value !== null && dp.value !== undefined;
            const Icon = meta.icon ?? Activity;
            const color = meta.color ?? (meta.type === "scale" ? "#4f46e5" : "#16a34a");

            return (
              <Card key={metric}>
                <CardContent>
                  <div style={{ textAlign: "center" }}>
                    <div className="icon-row">
                      <Icon style={{ width: 24, height: 24, color: hasValue ? color : "#9ca3af" }} />
                    </div>
                    <h2 className="card-title">{meta.title}</h2>
                    {hasValue ? (
                      <>
                        <p className="card-data" style={{ color }}>{meta.type === "scale" ? `${dp.value} / 10` : `${dp.value} ${meta.uom ?? ""}`}</p>
                        <p className="card-updated">Updated {fmtTime(dp.updatedAt ? new Date(dp.updatedAt) : null) ?? "—"}</p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                          <Button variant="secondary" className="btn-icon" onClick={() => {
                            setInputValue(dp.value);
                            setOpen({ type: metric, ...meta, ...dp });
                          }}
                          >
                            <Edit style={{ width: 16, height: 16 }} />
                          </Button>
                          <Button variant="ghost" className="btn-icon" aria-label={`Open ${metric} chart`} onClick={() => setOpen({ type: "chart", metric })}><LineChartIcon /></Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button className="btn-add" onClick={() => setOpen({ type: metric, ...meta, ...dp })}>+ Add</Button>
                        <p className="card-updated">No data yet</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          });
        })()}







        {/* Medication: Losartan */}
        <Card>
          <CardContent>
            <div style={{ textAlign: "center" }}>
              <div className="icon-row">
                <Pill style={{ width: 24, height: 24, color: losartan ? "#16a34a" : "#9ca3af" }} />
              </div>
              <h2 className="card-title">Medication: Losartan 50mg</h2>
              <p className="card-data" style={{ color: losartan ? "#16a34a" : "#6b7280" }}>{losartan ? "Taken" : "Not taken"}</p>
              <p className="card-updated">Updated {fmtTime(dayValues.losartanUpdatedAt ? new Date(dayValues.losartanUpdatedAt) : null) ?? "—"}</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "losartan" })}><Edit style={{ width: 16, height: 16 }} /></Button>
              </div>
            </div>
          </CardContent>
        </Card>



        {/* Blood Pressure */}
        <Card>
          <CardContent>
            <div style={{ textAlign: "center" }}>
              <div className="icon-row">
                <Gauge style={{ width: 24, height: 24, color: bpSystolic !== null && bpDiastolic !== null ? "#16a34a" : "#9ca3af" }} />
              </div>
              <h2 className="card-title">Blood Pressure</h2>
              {bpSystolic !== null && bpDiastolic !== null ? (
                <>
                  <p className="card-data" style={{ color: "#16a34a" }}>{bpSystolic}/{bpDiastolic}</p>
                  <p className="card-updated">Updated {fmtTime(dayValues.bpUpdatedAt ? new Date(dayValues.bpUpdatedAt) : null) ?? "—"}</p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                    <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "bp" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                    <Button variant="ghost" className="btn-icon" aria-label="Open blood pressure chart" onClick={() => setOpen({ type: "chart", metric: "bp" })}><LineChartIcon /></Button>
                  </div>
                </>
              ) : (
                <>
                  <Button className="btn-add" onClick={() => setOpen({ type: "bp" })}>+ Add</Button>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>No data yet</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={open !== null} onOpenChange={() => setOpen(null)}>
        {/* Date Picker */}
        {open?.type === "date" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select a date</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                disabled={(date) => date > today}
                modifiers={modifiers}
                modifiersClassNames={modifiersClassNames}
                initialFocus
              />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Close</Button>
              <Button onClick={() => setOpen(null)}>Use this date</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Chart modal (lazy-loaded) */}
        {open?.type === "chart" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{chartTitle(open.metric)}</DialogTitle>
            </DialogHeader>
            <Suspense fallback={<div style={{ height: 288, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading chart…</div>}>
              <ChartModal metric={open.metric} buildSeries={buildSeries} selectedDate={selectedDate} />
            </Suspense>
            <DialogFooter>
              <Button onClick={() => setOpen(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Single Values */}
        {open?.kind === "singleValue" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {open.title}</DialogTitle>
            </DialogHeader>
            <div>
              <Label htmlFor={open.type}>{open.title} ({open.uom})</Label>
              <Input id={open.type} type="number" value={inputValue ?? ""} onChange={(e) => setInputValue(e.target.value ? Number(e.target.value) : null)} />            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={(e) => { updateDayValues({ metric: open.type, inputValue}); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Blood Pressure */}
        {open?.type === "bp" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{bpSystolic === null || bpDiastolic === null ? "Add" : "Edit"} Blood Pressure</DialogTitle>
            </DialogHeader>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 8 }}>
              <div>
                <Label htmlFor="sys">Systolic</Label>
                <Input id="sys" type="number" value={bpSystolic ?? ""} onChange={(e) => setBpSystolic(e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <Label htmlFor="dia">Diastolic</Label>
                <Input id="dia" type="number" value={bpDiastolic ?? ""} onChange={(e) => setBpDiastolic(e.target.value ? Number(e.target.value) : null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ bpSystolic, bpDiastolic, bpUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Tired (1–10) */}
        {open?.type === "tired" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tired (0–10)</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }}>
              <Label htmlFor="tired">Tired (0–10)</Label>
              <div>
                <Slider id="tired" value={[tired ?? 0]} min={0} max={10} step={1} onValueChange={(v) => setTired(v[0])} />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                  <span>0 • Good</span>
                  <span>10 • Awful</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ tired, tiredUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Headache (1–10) */}
        {open?.type === "headache" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Headache (0–10)</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }}>
              <Label htmlFor="headache">Headache (0–10)</Label>
              <div>
                <Slider id="headache" value={[headache ?? 0]} min={0} max={10} step={1} onValueChange={(v) => setHeadache(v[0])} />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                  <span>0 • Good</span>
                  <span>10 • Awful</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ headache, headacheUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Back Ache (1–10) */}
        {open?.type === "back" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Back Ache (0–10)</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }}>
              <Label htmlFor="back">Back Ache (0–10)</Label>
              <div>
                <Slider id="back" value={[backAche ?? 0]} min={0} max={10} step={1} onValueChange={(v) => setBackAche(v[0])} />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                  <span>0 • Good</span>
                  <span>10 • Awful</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ backAche, backAcheUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
        {/* Losartan Dialog */}
        {open?.type === "losartan" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Losartan 50mg</DialogTitle>
            </DialogHeader>
            <div>
              <Label htmlFor="losartan">Did you take Losartan today?</Label>
              <div style={{ marginTop: 16 }}>
                <Switch checked={losartan ?? false} onCheckedChange={setLosartan} />
                <span style={{ marginLeft: 12 }}>{losartan ? "Yes" : "No"}</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ losartan, losartanUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
