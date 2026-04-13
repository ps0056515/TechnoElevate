/**
 * Margin utility functions shared across Requirements components.
 * Margin = (Bill Rate - Pay Rate) / Bill Rate × 100
 */

/**
 * Format a monthly rate as a dollar string.
 * @param {number|string} v
 * @returns {string}
 */
export const fmtRate = (v) => {
  const n = parseFloat(v);
  return n > 0 ? `$${Number(n).toLocaleString('en-US')}` : '—';
};

/**
 * Calculate margin percentage.
 * Returns null when bill_rate is 0 or falsy (no rate set).
 * @param {number|string} bill
 * @param {number|string} pay
 * @returns {number|null}
 */
export const calcMargin = (bill, pay) => {
  const b = parseFloat(bill);
  const p = parseFloat(pay) || 0;
  if (!b || b === 0) return null;
  return Math.round(((b - p) / b) * 100);
};

/**
 * Return a CSS colour variable based on margin %.
 * >= 35%  → green  (healthy)
 * 20–34%  → amber  (watch)
 * < 20%   → red    (risky)
 * null    → muted  (no rate set)
 * @param {number|null} pct
 * @returns {string}
 */
export const marginColor = (pct) => {
  if (pct === null || pct === undefined) return 'var(--text-muted)';
  if (pct >= 35) return 'var(--green)';
  if (pct >= 20) return 'var(--amber)';
  return 'var(--red)';
};
