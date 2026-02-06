/**
 * Formatting utilities for money and dates.
 */

/**
 * Format a number as USD currency.
 * Negative values shown in parentheses: ($1,234.56)
 * Zero shown as "—"
 */
export function formatMoney(n) {
  if (n === 0 || n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

/**
 * Format an ISO date string for display.
 * "2025-01-15" → "Jan 15, 2025"
 */
export function formatDate(d) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a date range for report headers.
 * "January 1 – December 31, 2025"
 */
export function formatDateRange(startDate, endDate) {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const startStr = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const endStr = end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}
