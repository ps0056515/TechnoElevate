/**
 * Sum invoice amounts (stored as INR in the DB) and return ₹ Cr for the VP view.
 * 1 Cr = 10,000,000 INR.
 */
const INR_PER_CRORE = 10_000_000;

function ymd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '1970-01-01';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {import('pg').Pool} pool
 * @param {Date} [now]
 * @returns {Promise<{ revenue_mtd_cr: number, revenue_ytd_cr: number, invoice_count_mtd: number, invoice_count_ytd: number }>}
 */
async function getInvoiceRevenueCrore(pool, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = new Date(y, m, 1);
  const monthEnd = new Date(y, m + 1, 0, 12, 0, 0, 0);
  const yearStart = new Date(y, 0, 1);
  const today = new Date(y, m, now.getDate(), 12, 0, 0, 0);

  const a = ymd(monthStart);
  const b = ymd(monthEnd);
  const c = ymd(yearStart);
  const t = ymd(today);

  try {
    const mtd = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::float AS s, COUNT(*)::int AS c
       FROM invoices
       WHERE issued_date IS NOT NULL
         AND issued_date::date >= $1::date
         AND issued_date::date <= $2::date`,
      [a, b]
    );
    const ytd = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::float AS s, COUNT(*)::int AS c
       FROM invoices
       WHERE issued_date IS NOT NULL
         AND issued_date::date >= $1::date
         AND issued_date::date <= $2::date`,
      [c, t]
    );
    const sM = mtd.rows[0]?.s || 0;
    const sY = ytd.rows[0]?.s || 0;
    return {
      revenue_mtd_cr: sM / INR_PER_CRORE,
      revenue_ytd_cr: sY / INR_PER_CRORE,
      invoice_count_mtd: mtd.rows[0]?.c || 0,
      invoice_count_ytd: ytd.rows[0]?.c || 0,
    };
  } catch (e) {
    return {
      revenue_mtd_cr: 0,
      revenue_ytd_cr: 0,
      invoice_count_mtd: 0,
      invoice_count_ytd: 0,
    };
  }
}

module.exports = { getInvoiceRevenueCrore, INR_PER_CRORE };
