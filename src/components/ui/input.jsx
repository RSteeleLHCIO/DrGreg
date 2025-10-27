import React from "react";

export function Input({ id, className = "", style = {}, ...rest }) {
    const baseStyle = { padding: 8, borderRadius: 8, border: "1px solid #e5e7eb", width: "100%" };
    return <input id={id} className={className} style={{ ...baseStyle, ...style }} {...rest} />;
}
