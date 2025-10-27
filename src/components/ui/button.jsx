import React from "react";

// Small button shim used by the preview. Accepts `variant` (primary|secondary|ghost)
export function Button({ children, variant, className = "", type = "button", ...props }) {
    const base = "btn";
    const vclass = variant === "ghost" ? "btn-ghost" : variant === "secondary" ? "btn-secondary" : "btn-primary";
    return (
        <button type={type} className={`${base} ${vclass} ${className}`.trim()} {...props}>
            {children}
        </button>
    );
}
