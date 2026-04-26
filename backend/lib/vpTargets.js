/**
 * VP “Targets vs reality”
 * - Targets: from bd_ops_vp_targets (admin) — optional until set, no app defaults
 * - Reality: engineers = onboarded rows (MTD) from BD snapshot; revenue = sum(invoices) in INR → ₹ Cr
 */
function toNum(n) {
  if (n == null || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/**
 * @param {object | null} row - DB row (targets only, reality columns ignored for display)
 * @param {object} derived
 * @param {number} derived.onboarded_mtd - count from BD: Status=Onboarded, En. date in current month
 * @param {number} [derived.revenue_mtd_cr] - from invoices, INR→Cr
 * @param {number} [derived.revenue_ytd_cr] - from invoices, calendar YTD, INR→Cr
 * @param {object} [derived.meta] - e.g. invoice counts
 */
function buildVpView(row, derived = {}) {
  const onboardedMtd = Number(derived.onboarded_mtd);
  const a = Number.isFinite(onboardedMtd) ? onboardedMtd : 0;

  const revMtd = toNum(derived.revenue_mtd_cr);
  const revYtd = toNum(derived.revenue_ytd_cr);
  const mtd = revMtd == null ? 0 : revMtd;
  const ytd = revYtd == null ? 0 : revYtd;

  const t = toNum(row?.monthly_engineer_target);
  const fy = toNum(row?.revenue_fy_target_cr);
  const pl = row?.period_label != null && String(row.period_label).trim() ? String(row.period_label).trim() : null;

  const engineer_gap_to_monthly_target = t != null && Number.isFinite(t) ? t - a : null;
  const engineer_pct_of_monthly_target = t != null && t !== 0 ? a / t : null;
  const revenue_mtd_pct_of_annual = fy != null && fy > 0 ? mtd / fy : null;
  const revenue_prorated_monthly = fy != null && fy > 0 ? fy / 12 : null;
  const revenue_gap_mtd_vs_prorated = revenue_prorated_monthly != null ? revenue_prorated_monthly - mtd : null;

  return {
    labels: {
      monthly_engineer_target: 'Monthly net-add target (headcount) — your target',
      net_engineer_actual: 'Onboarded this month (from BD DAR snapshot — Status + En. date in month)',
      revenue_fy_target_cr: 'Revenue target — FY (₹ Cr) — your target',
      revenue_mtd_cr: 'Revenue this month (₹ Cr) — from invoices in database',
      revenue_ytd_cr: 'Revenue YTD (₹ Cr) — from invoices, calendar year',
    },
    monthly_engineer_target: t,
    net_engineer_actual: a,
    engineer_gap_to_monthly_target,
    engineer_pct_of_monthly_target,
    engineer_behind: engineer_gap_to_monthly_target != null && engineer_gap_to_monthly_target > 0,
    revenue_fy_target_cr: fy,
    revenue_mtd_cr: mtd,
    revenue_ytd_cr: ytd,
    revenue_mtd_pct_of_annual: revenue_mtd_pct_of_annual,
    revenue_prorated_monthly_cr: revenue_prorated_monthly,
    revenue_gap_mtd_vs_prorated_cr: revenue_gap_mtd_vs_prorated,
    period_label: pl,
    updated_at: row?.updated_at ?? null,
    reality: {
      engineers_onboarded_mtd: a,
      engineer_data_source: 'bd_snapshot',
      revenue_data_source: 'invoices',
      invoice_count_mtd: derived.invoice_count_mtd,
      invoice_count_ytd: derived.invoice_count_ytd,
    },
  };
}

module.exports = { buildVpView };
