import React, { useMemo, useState, useEffect, lazy, Suspense } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, ChevronLeft, ChevronRight, Moon, Brain, Bone, Edit, Pill } from "lucide-react";
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
  // --- Static metric definitions -----------------------------------------------
  const cardDefinitions = [
    {
      metricNames: ["weight"],
      cardName: "weight",
      title: "Weight",
      uom: "lbs",
      icon: Activity,
      kind: "singleValue"
    },
    {
      metricNames: ["heart"],
      cardName: "heart",
      title: "Heart Rate",
      uom: "bpm",
      icon: Heart,
      kind: "singleValue"
    },
    {
      metricNames: ["systolic", "diastolic"],
      cardName: "blood-pressure",
      title: "Blood Pressure",
      uom: "",
      icon: Activity,
      kind: "singleValue"
    },
    {
      metricNames: ["glucose"],
      cardName: "glucose",
      title: "Glucose",
      uom: "mg/dL",
      icon: Droplet,
      kind: "singleValue"
    },
    {
      metricNames: ["tired"],
      cardName: "tired",
      title: "Tired",
      uom: "/10",
      icon: Moon,
      color: "#4f46e5",
      kind: "slider"
    },
    {
      metricNames: ["headache"],
      cardName: "headache",
      title: "Headache",
      uom: "/10",
      icon: Brain,
      color: "#7c3aed",
      kind: "slider"
    },
    {
      metricNames: ["back"],
      cardName: "back",
      title: "Back Ache",
      uom: "/10",
      icon: Bone,
      color: "#f59e0b",
      kind: "slider"
    },
    // Example multi-metric card:
    // {
    //   metricNames: ["tired", "headache", "back"],
    //   cardName: "symptoms",
    //   title: "Symptoms",
    //   uom: "/10",
    //   icon: Moon,
    //   color: "#4f46e5",
    //   kind: "slider"
    // },
  ];

  // --- Per-day records store -------------------------------------------------
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
    setRecords((prev) => {
      const dp = prev.dataPoints[newData.metric];
      const updatedDataPoints = {
        ...prev.dataPoints,
        [newData.metric]: {
          dayValue: {
            ...(dp?.dayValue ?? {}),
            [selectedKey]: { value: newData.inputValue, updatedAt: new Date().toISOString() }
          }
        }
      };
      return {
        ...prev,
        dataPoints: updatedDataPoints
      };
    });
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
          const points = records.dataPoints ?? {};
          return cardDefinitions.map((meta) => {
            // Gather values for all metrics in this card
            const metricValues = meta.metricNames.map(metricName => {
              const data = points[metricName] ?? {};
              const fallbackValue = records[selectedKey]?.[metricName] ?? null;
              const fallbackUpdated = records[selectedKey]?.[`${metricName}UpdatedAt`] ?? null;
              const dp = (data.dayValue && data.dayValue[selectedKey]) ?? { value: fallbackValue, updatedAt: fallbackUpdated };
              return { value: dp.value, updatedAt: dp.updatedAt };
            });
            const hasValue = metricValues.some(v => v.value !== null && v.value !== undefined);
            const Icon = meta.icon ?? Activity;
            const color = meta.color ?? (meta.kind === "slider" ? "#4f46e5" : "#16a34a");

            // Display values separated by '/'
            const displayValue = metricValues.map((v, idx) =>
              meta.kind === "slider"
                ? `${v.value ?? "—"}`
                : `${v.value ?? "—"} ${meta.uom ?? ""}`
            ).join(" / ");
            // Use the first updatedAt for display
            const updatedAt = metricValues.find(v => v.updatedAt)?.updatedAt;

            return (
              <Card key={meta.cardName}>
                <CardContent>
                  <div style={{ textAlign: "center" }}>
                    <div className="icon-row">
                      <Icon style={{ width: 24, height: 24, color: hasValue ? color : "#9ca3af" }} />
                    </div>
                    <h2 className="card-title">{meta.title}</h2>
                    {hasValue ? (
                      <>
                        <p className="card-data" style={{ color }}>{displayValue}{meta.kind === "slider" ? " of 10" : ""}</p>
                        <p className="card-updated">Updated {fmtTime(updatedAt ? new Date(updatedAt) : null) ?? "—"}</p>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                          <Button variant="secondary" className="btn-icon" onClick={() => {
                            setInputValue(metricValues[0].value); // Only sets first metric for now
                            setOpen({ type: meta.cardName, ...meta, metricValues });
                          }}>
                            <Edit style={{ width: 16, height: 16 }} />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Button className="btn-add" onClick={() => setOpen({ type: meta.cardName, ...meta, metricValues })}>+ Add</Button>
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

        {/* Single Values */}
        {open?.kind === "singleValue" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {open.title}</DialogTitle>
            </DialogHeader>
            <div>
              {open.metricNames.length > 1 ? (
                open.metricNames.map((metricName, idx) => (
                  <div key={metricName} style={{ marginBottom: 12 }}>
                    <Label htmlFor={metricName}>{metricName}{open.uom ? ` (${open.uom})` : ""}</Label>
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
                ))
              ) : (
                <>
                  <Label htmlFor={open.metricNames[0]}>{open.title} ({open.uom})</Label>
                  <Input
                    id={open.metricNames[0]}
                    type="number"
                    style={{ width: "auto" }}
                    value={open.metricValues?.[0]?.value ?? ""}
                    onChange={(e) => {
                      const newValue = e.target.value ? Number(e.target.value) : null;
                      setOpen({ ...open, metricValues: [{ ...open.metricValues?.[0], value: newValue }] });
                    }}
                  />
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => {
                open.metricNames.forEach((metricName, idx) => {
                  updateDayValues({ metric: metricName, inputValue: open.metricValues?.[idx]?.value });
                });
                setOpen(null);
              }}>Save</Button>
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

        {/* 1-10 scale metrics (tired, headache, back) */}
        {open?.kind === "slider" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {open.title}</DialogTitle>
            </DialogHeader>
            <div style={{ paddingTop: 8 }}>
              <Label htmlFor={open.type}>{open.title}</Label>
              <div>
                <Slider
                  id={open.type}
                  value={[inputValue ?? 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setInputValue(v[0])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateDayValues({ metric: open.type, inputValue });
                      setOpen(null);
                    }
                  }}
                />
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280" }}>
                  <span>0 • Good</span>
                  <span style={{ fontSize: '24px', fontWeight: 600, color: "#222", margin: "0 12px" }}>{inputValue ?? 0}</span>
                  <span>10 • Awful</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { updateDayValues({ metric: open.type, inputValue }); setOpen(null); }}>Save</Button>
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
