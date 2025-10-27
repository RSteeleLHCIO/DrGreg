import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Activity, Heart, Droplet, Gauge, CalendarDays, ChevronLeft, ChevronRight, LineChart as LineChartIcon, Moon, Brain, Bone, Edit } from "lucide-react";
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
    const [selectedDate, setSelectedDate] = useState(new Date());
    const selectedKey = useMemo(() => toKey(selectedDate), [selectedDate]);

    // Extract values for the selected day (fallback to nulls)
    const dayValues = records[selectedKey] ?? {
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
    const [weight, setWeight] = useState(dayValues.weight);
    const [glucose, setGlucose] = useState(dayValues.glucose);
    const [heartRate, setHeartRate] = useState(dayValues.heartRate);
    const [bpSystolic, setBpSystolic] = useState(dayValues.bpSystolic);
    const [bpDiastolic, setBpDiastolic] = useState(dayValues.bpDiastolic);
    const [tired, setTired] = useState(dayValues.tired);
    const [headache, setHeadache] = useState(dayValues.headache);
    const [backAche, setBackAche] = useState(dayValues.backAche);

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

    return (
        <div style={{ padding: 24 }}>
            {/* Header / Date Picker */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700 }}>Overview</h1>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button variant="ghost" onClick={prevDay} aria-label="Previous day">
                        <ChevronLeft />
                    </Button>
                    <Button variant="outline" onClick={() => setOpen({ type: "date" })}>
                        <CalendarDays style={{ marginRight: 8 }} /> {niceDate}
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
                {/* Weight */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Activity style={{ width: 24, height: 24, color: weight !== null ? "#16a34a" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Weight</h2>
                            {weight !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#16a34a" }}>{weight} lbs</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.weightUpdatedAt ? new Date(dayValues.weightUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "weight" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open weight chart" onClick={() => setOpen({ type: "chart", metric: "weight" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "weight" })}>+ Add</Button>
                                    <p className="card-updated">No data yet</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Tired (1–10) */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Moon style={{ width: 24, height: 24, color: tired !== null ? "#4f46e5" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Tired</h2>
                            {tired !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#4f46e5" }}>{tired} / 10</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.tiredUpdatedAt ? new Date(dayValues.tiredUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "tired" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open tired chart" onClick={() => setOpen({ type: "chart", metric: "tired" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "tired" })}>+ Add</Button>
                                    <p className="card-updated">No data yet</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Headache (1–10) */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Brain style={{ width: 24, height: 24, color: headache !== null ? "#7c3aed" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Headache</h2>
                            {headache !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#7c3aed" }}>{headache} / 10</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.headacheUpdatedAt ? new Date(dayValues.headacheUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "headache" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open headache chart" onClick={() => setOpen({ type: "chart", metric: "headache" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "headache" })}>+ Add</Button>
                                    <p className="card-updated">No data yet</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Back Ache (1–10) */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Bone style={{ width: 24, height: 24, color: backAche !== null ? "#f59e0b" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Back Ache</h2>
                            {backAche !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#f59e0b" }}>{backAche} / 10</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.backAcheUpdatedAt ? new Date(dayValues.backAcheUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "back" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open back ache chart" onClick={() => setOpen({ type: "chart", metric: "back" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "back" })}>+ Add</Button>
                                    <p className="card-updated">No data yet</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Heart Rate */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Heart style={{ width: 24, height: 24, color: heartRate !== null ? "#dc2626" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Heart Rate</h2>
                            {heartRate !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#dc2626" }}>{heartRate} bpm</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.heartUpdatedAt ? new Date(dayValues.heartUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "heart" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open heart rate chart" onClick={() => setOpen({ type: "chart", metric: "heart" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "heart" })}>+ Add</Button>
                                    <p style={{ fontSize: 12, color: "#9ca3af" }}>No data yet</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Glucose */}
                <Card>
                    <CardContent>
                        <div style={{ textAlign: "center" }}>
                            <div className="icon-row">
                                <Droplet style={{ width: 24, height: 24, color: glucose !== null ? "#2563eb" : "#9ca3af" }} />
                            </div>
                            <h2 className="card-title">Glucose</h2>
                            {glucose !== null ? (
                                <>
                                    <p className="card-data" style={{ color: "#2563eb" }}>{glucose} mg/dL</p>
                                    <p className="card-updated">Updated {fmtTime(dayValues.glucoseUpdatedAt ? new Date(dayValues.glucoseUpdatedAt) : null) ?? "—"}</p>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}>
                                        <Button variant="secondary" className="btn-icon" onClick={() => setOpen({ type: "glucose" })}><Edit style={{ width: 16, height: 16 }} /></Button>
                                        <Button variant="ghost" className="btn-icon" aria-label="Open glucose chart" onClick={() => setOpen({ type: "chart", metric: "glucose" })}><LineChartIcon /></Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Button className="btn-add" onClick={() => setOpen({ type: "glucose" })}>+ Add</Button>
                                    <p style={{ fontSize: 12, color: "#9ca3af" }}>No data yet</p>
                                </>
                            )}
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

                {/* Chart modal */}
                {open?.type === "chart" && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{chartTitle(open.metric)}</DialogTitle>
                        </DialogHeader>
                        <div style={{ height: 288, width: "100%", paddingTop: 8 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                {open.metric === "bp" ? (
                                    <LineChart data={buildSeries("bp", selectedDate)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="sys" name="Systolic" dot={false} strokeWidth={2} />
                                        <Line type="monotone" dataKey="dia" name="Diastolic" dot={false} strokeWidth={2} />
                                    </LineChart>
                                ) : (
                                    <LineChart data={buildSeries(open.metric, selectedDate)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" />
                                        <YAxis domain={[0, open.metric === "weight" || open.metric === "glucose" || open.metric === "heart" ? "auto" : 10]} />
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
                        <div style={{ paddingTop: 8 }}>
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
                        <div style={{ paddingTop: 8 }}>
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
                        <div style={{ paddingTop: 8 }}>
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
                                    <span>0 • Good / No issues</span>
                                    <span>5</span>
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
                                    <span>0 • Good / No issues</span>
                                    <span>5</span>
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
                                    <span>0 • Good / No issues</span>
                                    <span>5</span>
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
            </Dialog>
        </div>
    );
}
