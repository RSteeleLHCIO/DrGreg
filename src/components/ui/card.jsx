import React from "react";

export function Card({ children, className = "" }) {
    return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function CardContent({ children, className = "" }) {
    return <div className={`card-content ${className}`.trim()}>{children}</div>;
}
