import React from "react";

// Minimal calendar: render an <input type=date> that calls onSelect with a Date
export function Calendar({ mode, selected, onSelect, disabled, className = "", style = {} }) {
    const toInput = (d) => {
        if (!d) return "";
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };
    return (
        <input
            type="date"
            className={className}
            style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb", ...style }}
            value={toInput(selected)}
            onChange={(e) => {
                const v = e.target.value;
                if (!v) return onSelect && onSelect(null);
                const d = new Date(v + "T00:00:00");
                if (disabled && disabled(d)) return;
                onSelect && onSelect(d);
            }}
        />
    );
}
