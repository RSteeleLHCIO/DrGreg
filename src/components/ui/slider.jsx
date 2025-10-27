import React from "react";

export function Slider({ id, value = [0], min = 0, max = 10, step = 1, onValueChange, className = "", style = {} }) {
    const v = Array.isArray(value) ? value[0] : value;
    return (
        <input
            id={id}
            className={className}
            type="range"
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => onValueChange && onValueChange([Number(e.target.value)])}
            style={{ width: "100%", ...style }}
        />
    );
}
