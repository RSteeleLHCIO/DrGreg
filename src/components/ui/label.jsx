import React from "react";

export function Label({ children, htmlFor, className = "", style = {} }) {
    return (
        <label htmlFor={htmlFor} className={className} style={{ display: "block", fontSize: 13, marginBottom: 6, ...style }}>
            {children}
        </label>
    );
}
