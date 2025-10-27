import React from "react";

// Very small dialog shim. When `open` is falsy, render nothing.
export function Dialog({ open, onOpenChange, children }) {
    if (!open) return null;
    // Clicking the overlay will close the dialog if `onOpenChange` provided.
    return (
        <div className="dialog-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50 }} onClick={() => onOpenChange && onOpenChange(null)}>
            {children}
        </div>
    );
}

export function DialogContent({ children, className = "" }) {
    return (
        <div
            className={`card ${className}`.trim()}
            style={{ maxWidth: 720, margin: "40px auto", padding: 16, position: "relative" }}
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
