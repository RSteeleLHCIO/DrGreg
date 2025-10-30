/**
 * Format a Date object as YYYY-MM-DD string
 * @param {Date} d - The date to format
 * @returns {string} Date string in YYYY-MM-DD format
 */
export function toKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/**
 * Format a Date object as a localized time string
 * @param {Date|null} d - The date to format
 * @returns {string|null} Formatted time string or null if invalid
 */
export function fmtTime(d) {
    if (!d) return null;
    try {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
        return null;
    }
}

/**
 * Convert a string to sentence case (first letter uppercase, rest lowercase)
 * @param {string} str - The string to convert
 * @returns {string} Sentence-cased string
 */
export function toSentenceCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
