import React from "react";
import "../../ui.css";

// Very small dialog shim. When `open` is falsy, render nothing.
export function Dialog({ open, onOpenChange, children }) {
    if (!open) return null;
    // Clicking the overlay will close the dialog if `onOpenChange` provided.
    return (
        <div className="dialog-overlay" onClick={() => onOpenChange && onOpenChange(null)}>
            {children}
        </div>
    );
}

export function DialogContent({ children, className = "" }) {
    return (
        <div
            className={`dialog-content ${className}`.trim()}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
}

export function DialogHeader({ children }) {
    return <div style={{ marginBottom: 8 }}>{children}</div>;
}

export function DialogTitle({ children }) {
    return <h3 style={{ margin: 0 }}>{children}</h3>;
}

export function DialogFooter({ children }) {
    return <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>{children}</div>;
}
