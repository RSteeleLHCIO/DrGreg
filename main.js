import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, ChevronLeft, ChevronRight, LineChart as LineChartIcon, Moon, Brain, Bone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Helper to format a Date as YYYY-MM-DD (key for our records map)
function toKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(d?: Date | null) {
  if (!d) return null;
  try {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return null;
  }
}

export default function HealthAppUI() {
  // --- Per-day records store -------------------------------------------------
  type DayRecord = {
    weight: number | null;
    weightUpdatedAt?: string | null;
    glucose: number | null;
    glucoseUpdatedAt?: string | null;
    heartRate: number | null;
    heartUpdatedAt?: string | null;
    bpSystolic: number | null;
    bpDiastolic: number | null;
    bpUpdatedAt?: string | null;
    // New wellness 1–10 ratings
    tired: number | null;
    tiredUpdatedAt?: string | null;
    headache: number | null;
    headacheUpdatedAt?: string | null;
    backAche: number | null;
    backAcheUpdatedAt?: string | null;
  };

  const [records, setRecords] = useState<Record<string, DayRecord>>(() => {
    const todayKey = toKey(new Date());
    return {
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);

  // Extract values for the selected day (fallback to nulls)
  const dayValues: DayRecord = records[selectedKey] ?? {
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

  // Local state mirrors for inputs (so dialogs edit the selected day)
  const [weight, setWeight] = useState<number | null>(dayValues.weight);
  const [glucose, setGlucose] = useState<number | null>(dayValues.glucose);
  const [heartRate, setHeartRate] = useState<number | null>(dayValues.heartRate);
  const [bpSystolic, setBpSystolic] = useState<number | null>(dayValues.bpSystolic);
  const [bpDiastolic, setBpDiastolic] = useState<number | null>(dayValues.bpDiastolic);
  const [tired, setTired] = useState<number | null>(dayValues.tired);
  const [headache, setHeadache] = useState<number | null>(dayValues.headache);
  const [backAche, setBackAche] = useState<number | null>(dayValues.backAche);

  // Sync local card values whenever the selected date changes
  useEffect(() => {
    const v: DayRecord = records[selectedKey] ?? {
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
  }, [records, selectedKey]);

  // --- Dialog state ----------------------------------------------------------
  type ChartMetric = "weight" | "glucose" | "heart" | "bp" | "tired" | "headache" | "back";
  const [open, setOpen] = useState<
    | null
    | { type: "weight" }
    | { type: "glucose" }
    | { type: "heart" }
    | { type: "bp" }
    | { type: "tired" }
    | { type: "headache" }
    | { type: "back" }
    | { type: "date" }
    | { type: "chart"; metric: ChartMetric }
  >(null);

  // Save helpers write into the records map for the selected day
  function upsertSelectedDay(update: Partial<DayRecord>) {
    setRecords((prev) => {
      const current: DayRecord = prev[selectedKey] ?? {
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
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
  } as const;

  const modifiersClassNames = {
    hasData:
      "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-blue-500",
  } as const;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- Chart helpers: build last-14-days series for a metric -----------------
  function buildSeries(metric: ChartMetric, anchor: Date) {
    const data: { date: string; value?: number | null; sys?: number | null; dia?: number | null }[] = [];
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

  const chartTitle = (m: ChartMetric) =>
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

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header / Date Picker */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="rounded-full" onClick={prevDay} aria-label="Previous day">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="outline" onClick={() => setOpen({ type: "date" })} className="rounded-2xl">
            <CalendarDays className="w-4 h-4 mr-2" /> {niceDate}
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={nextDay} aria-label="Next day">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Weight */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Activity className={`mx-auto w-6 h-6 ${weight !== null ? "text-green-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Weight</h2>
            {weight !== null ? (
              <>
                <p className="text-2xl font-bold text-green-600">{weight} lbs</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.weightUpdatedAt ? new Date(dayValues.weightUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "weight" })}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "weight" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "weight" })}>
                  + Add
                </Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Heart Rate */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Heart className={`mx-auto w-6 h-6 ${heartRate !== null ? "text-red-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Heart Rate</h2>
            {heartRate !== null ? (
              <>
                <p className="text-2xl font-bold text-red-600">{heartRate} bpm</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.heartUpdatedAt ? new Date(dayValues.heartUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "heart" })}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "heart" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "heart" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Glucose */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Droplet className={`mx-auto w-6 h-6 ${glucose !== null ? "text-blue-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Glucose</h2>
            {glucose !== null ? (
              <>
                <p className="text-2xl font-bold text-blue-600">{glucose} mg/dL</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.glucoseUpdatedAt ? new Date(dayValues.glucoseUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "glucose" })}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "glucose" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "glucose" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Blood Pressure */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Gauge className={`mx-auto w-6 h-6 ${bpSystolic !== null && bpDiastolic !== null ? "text-green-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Blood Pressure</h2>
            {bpSystolic !== null && bpDiastolic !== null ? (
              <>
                <p className="text-2xl font-bold text-green-600">{bpSystolic}/{bpDiastolic}</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.bpUpdatedAt ? new Date(dayValues.bpUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "bp" })}>
                    Edit
                  </Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "bp" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "bp" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Tired (1–10) */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Moon className={`mx-auto w-6 h-6 ${tired !== null ? "text-indigo-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Tired</h2>
            {tired !== null ? (
              <>
                <p className="text-2xl font-bold text-indigo-600">{tired} / 10</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.tiredUpdatedAt ? new Date(dayValues.tiredUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "tired" })}>Edit</Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "tired" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "tired" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Headache (1–10) */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Brain className={`mx-auto w-6 h-6 ${headache !== null ? "text-purple-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Headache</h2>
            {headache !== null ? (
              <>
                <p className="text-2xl font-bold text-purple-600">{headache} / 10</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.headacheUpdatedAt ? new Date(dayValues.headacheUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "headache" })}>Edit</Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "headache" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "headache" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Back Ache (1–10) */}
        <Card className="rounded-2xl shadow">
          <CardContent className="p-4 text-center space-y-2">
            <Bone className={`mx-auto w-6 h-6 ${backAche !== null ? "text-amber-600" : "text-gray-400"}`} />
            <h2 className="text-lg font-semibold">Back Ache</h2>
            {backAche !== null ? (
              <>
                <p className="text-2xl font-bold text-amber-600">{backAche} / 10</p>
                <p className="text-xs text-gray-400">Updated {fmtTime(dayValues.backAcheUpdatedAt ? new Date(dayValues.backAcheUpdatedAt) : null) ?? "—"}</p>
                <div className="flex gap-2 justify-center pt-1">
                  <Button variant="secondary" className="rounded-2xl px-4 py-2" onClick={() => setOpen({ type: "back" })}>Edit</Button>
                  <Button variant="ghost" className="rounded-2xl px-3 py-2" onClick={() => setOpen({ type: "chart", metric: "back" })}>
                    <LineChartIcon className="w-4 h-4 mr-1" /> Chart
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Button className="mt-4 rounded-2xl px-4 py-2 w-full" onClick={() => setOpen({ type: "back" })}>+ Add</Button>
                <p className="text-sm text-gray-400">No data yet</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={open !== null} onOpenChange={() => setOpen(null)}>
        {/* Date Picker */}
        {open?.type === "date" && (
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Select a date</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                // Gray out future dates
                disabled={(date) => date > today}
                // Add a small dot for days that have any data
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

        {/* Chart modal */}
        {open?.type === "chart" && (
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>{chartTitle(open.metric)}</DialogTitle>
            </DialogHeader>
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {open.metric === "bp" ? (
                  <LineChart data={buildSeries("bp", selectedDate)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sys" name="Systolic" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="dia" name="Diastolic" dot={false} strokeWidth={2} />
                  </LineChart>
                ) : (
                  <LineChart data={buildSeries(open.metric, selectedDate)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, open.metric === "weight" || open.metric === "glucose" || open.metric === "heart" ? "auto" : 10]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Weight */}
        {open?.type === "weight" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Weight</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="weight">Weight (lbs)</Label>
              <Input id="weight" type="number" value={weight ?? ""} onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : null)} />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ weight, weightUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Glucose */}
        {open?.type === "glucose" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Glucose</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="glucose">Glucose (mg/dL)</Label>
              <Input id="glucose" type="number" value={glucose ?? ""} onChange={(e) => setGlucose(e.target.value ? Number(e.target.value) : null)} />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ glucose, glucoseUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Heart Rate */}
        {open?.type === "heart" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{heartRate === null ? "Add" : "Edit"} Heart Rate</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="hr">Heart Rate (bpm)</Label>
              <Input id="hr" type="number" value={heartRate ?? ""} onChange={(e) => setHeartRate(e.target.value ? Number(e.target.value) : null)} />
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ heartRate, heartUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}

        {/* Blood Pressure */}
        {open?.type === "bp" && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{bpSystolic === null || bpDiastolic === null ? "Add" : "Edit"} Blood Pressure</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sys">Systolic</Label>
                <Input id="sys" type="number" value={bpSystolic ?? ""} onChange={(e) => setBpSystolic(e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div className="space-y-2">
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
            <div className="space-y-2 py-2">
              <Label htmlFor="tired">Tired (0–10)</Label>
              <div className="pt-1">
                <Slider
                  id="tired"
                  value={[tired ?? 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setTired(v[0])}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>0 • Good / No issues</span>
                  <span>5</span>
                  <span>10 • Awful</span>
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
            <div className="space-y-2 py-2">
              <Label htmlFor="headache">Headache (0–10)</Label>
              <div className="pt-1">
                <Slider
                  id="headache"
                  value={[headache ?? 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setHeadache(v[0])}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>0 • Good / No issues</span>
                  <span>5</span>
                  <span>10 • Awful</span>
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
            <div className="space-y-2 py-2">
              <Label htmlFor="back">Back Ache (0–10)</Label>
              <div className="pt-1">
                <Slider
                  id="back"
                  value={[backAche ?? 0]}
                  min={0}
                  max={10}
                  step={1}
                  onValueChange={(v) => setBackAche(v[0])}
                />
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>0 • Good / No issues</span>
                  <span>5</span>
                  <span>10 • Awful</span>
                </div>
              </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => { upsertSelectedDay({ backAche, backAcheUpdatedAt: new Date().toISOString() }); setOpen(null); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

