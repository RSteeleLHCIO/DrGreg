import React from "react";
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

export default function ChartModal({ metric, buildSeries, selectedDate }) {
    return (
        <div style={{ height: 288, width: "100%", paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
                {metric === "bp" ? (
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
                    <LineChart data={buildSeries(metric, selectedDate)} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[0, metric === "weight" || metric === "glucose" || metric === "heart" ? "auto" : 10]} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}
