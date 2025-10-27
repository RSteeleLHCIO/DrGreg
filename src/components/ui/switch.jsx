import React from "react";
import "../../ui.css";

export function Switch({ checked = false, onCheckedChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={`switch-root ${checked ? "checked" : ""}`}
            onClick={() => onCheckedChange?.(!checked)}
        >
            <span className="switch-thumb" />
        </button>
    );
}