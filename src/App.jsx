import React, { useMemo, useState } from "react";
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
import { toKey, fmtTime, toSentenceCase } from "./utils/helpers";

export default function App() {

  // --- Static metric definitions -----------------------------------------------
  const metricConfig = {
    weight: { kind: "singleValue", uom: "lbs" },
    pain: { kind: "slider", uom: "" },
    back: { kind: "slider", uom: "" },
    headache: { kind: "slider", uom: "" },
    tired: { kind: "slider", uom: "" },
    temperature: { kind: "singleValue", uom: "°F" },
    heart: { kind: "singleValue", uom: "bpm" },
    systolic: { kind: "singleValue", uom: "" },
    diastolic: { kind: "singleValue", uom: "" },
    glucose: { kind: "singleValue", uom: "mg/dL" },
    tylenol: { kind: "switch", uom: "" },
    losartan: { kind: "switch", uom: "" }
  };

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
    };
  });

  // --- Selected day ----------------------------------------------------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);

  // Get day values directly from records
  const dayValues = useMemo(() => records[selectedKey] ?? {}, [records, selectedKey]);

  // Update metric values in the records
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
              const config = metricConfig[metricName];
              const data = points[metricName] ?? {};
              const fallbackValue = records[selectedKey]?.[metricName] ?? null;
              const fallbackUpdated = records[selectedKey]?.[`${metricName}UpdatedAt`] ?? null;
              const dp = (data.dayValue && data.dayValue[selectedKey]) ?? { value: fallbackValue, updatedAt: fallbackUpdated };
              return { metric: metricName, ...config, value: dp.value, updatedAt: dp.updatedAt };
            });
            const hasValue = metricValues.some(mv => mv.value !== null && mv.value !== undefined);
            const Icon = meta.icon ?? Activity;
            const color = meta.color ?? (meta.metricNames.some(name => metricConfig[name].kind === "slider") ? "#4f46e5" : "#16a34a");

            // Display values separated by '/'
            const displayValue = metricValues.map(mv => {
              if (mv.kind === "slider") {
                return `${mv.value ?? "—"}`;
              } else if (mv.kind === "switch") {
                return mv.value === true ? "Yes" : mv.value === false ? "No" : "—";
              } else {
                return `${mv.value ?? "—"}${mv.uom ? ` ${mv.uom}` : ""}`;
              }
            }).join(" / ");
            // Use the first updatedAt for display
            const updatedAt = metricValues.find(v => v.updatedAt)?.updatedAt;

            return (
              <Card key={meta.cardName}>
                <CardContent>
                  <div
                    onClick={() => setOpen({
                      type: meta.cardName,
                      ...meta,
                      metricValues
                    })}
                    style={{ cursor: "pointer", textAlign: "center" }}
                  >
                    <div className="icon-row">
                      <Icon style={{ width: 24, height: 24, color: hasValue ? color : "#9ca3af" }} />
                    </div>
                    <h2 className="card-title">{meta.title}</h2>
                    {hasValue ? (
                      <>
                        <p className="card-data" style={{ color }}>{displayValue}{meta.kind === "slider" ? " of 10" : ""}</p>
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

        {/* Single Value Metrics */}
        {open?.metricNames && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {open.title}</DialogTitle>
            </DialogHeader>
            <div>
              {open.metricNames.map((metricName, idx) => {
                const kind = metricConfig[metricName].kind;

                if (kind === "slider") {
                  return (
                    <div key={metricName} style={{ marginBottom: 16 }}>
                      <Label htmlFor={metricName}>{toSentenceCase(metricName)}</Label>
                      <div>
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
                      <Label htmlFor={metricName}>{toSentenceCase(metricName)}</Label>
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
                      <Label htmlFor={metricName}>{toSentenceCase(metricName)}{metricConfig[metricName].uom ? ` (${metricConfig[metricName].uom})` : ""}</Label>
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
      </Dialog>
    </div>
  );
}
