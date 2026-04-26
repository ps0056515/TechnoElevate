/**
 * Director / board summary — one object for a compact "three pillars" view.
 * Revenue & headcount reality match VP view (invoices + BD DAR); bench from executive + performance MTD.
 */

function toNum(n) {
  if (n == null || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

/**
 * @param {object} opts
 * @param {object} opts.vp - buildVpView output
 * @param {object} opts.executive - computeExecutiveSummary
 * @param {object} [opts.bd_performance] - from computeExtendedViews
 * @param {Date} [opts.now] - for linear revenue pace
 */
function buildBoardSummary({ vp, executive, bd_performance, now = new Date() }) {
  const fy = toNum(vp?.revenue_fy_target_cr);
  const mtd = toNum(vp?.revenue_mtd_cr) ?? 0;
  const ytd = toNum(vp?.revenue_ytd_cr) ?? 0;

  const y = now.getFullYear();
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  const yearMs = end - start;
  const elapsed = Math.min(1, Math.max(0, (now - start) / yearMs));
  const linearYtdExpectedCr = fy != null && fy > 0 ? fy * elapsed : null;
  const ytdVsLinearCr = linearYtdExpectedCr != null ? ytd - linearYtdExpectedCr : null;

  const monthlyTarget = toNum(vp?.monthly_engineer_target);
  const onboardedMtd = Number(
    vp?.reality?.engineers_onboarded_mtd != null
      ? vp.reality.engineers_onboarded_mtd
      : vp?.net_engineer_actual
  );
  const a = Number.isFinite(onboardedMtd) ? onboardedMtd : 0;

  const perf = bd_performance || {};
  return {
    period_month_label: perf.month_label || null,
    revenue: {
      fy_target_cr: fy,
      mtd_cr: mtd,
      ytd_cr: ytd,
      ytd_as_pct_of_fy: fy != null && fy > 0 ? ytd / fy : null,
      linear_ytd_expected_cr: linearYtdExpectedCr,
      ytd_vs_linear_cr: ytdVsLinearCr,
      invoice_count_mtd: vp?.reality?.invoice_count_mtd ?? null,
      invoice_count_ytd: vp?.reality?.invoice_count_ytd ?? null,
    },
    headcount: {
      monthly_target: monthlyTarget,
      onboarded_mtd: a,
      gap_to_target: vp?.engineer_gap_to_monthly_target ?? (monthlyTarget != null ? monthlyTarget - a : null),
      pct_of_target: vp?.engineer_pct_of_monthly_target ?? (monthlyTarget != null && monthlyTarget !== 0 ? a / monthlyTarget : null),
    },
    bench: {
      selection_rate_bench: executive?.selection_rate_bench_interviews ?? null,
      total_interviews_all_time: executive?.total_interviews ?? null,
      bench_interviews_mtd: perf.bench_interviews_mtd ?? null,
      market_interviews_mtd: perf.market_interviews_mtd ?? null,
      total_interviews_mtd: perf.total_interviews_mtd ?? null,
      bench_strength_rfd: executive?.bench_strength_rfd ?? null,
    },
    definitions: {
      revenue:
        'FY target is optional (set on VP / Targets). MTD and YTD are from posted invoices in this database (INR → ₹ Cr). Linear “pace” line assumes even revenue over the calendar year (not India FY unless your target period matches).',
      headcount:
        '“Onboarded this month” counts BD DAR rows with status Onboarded and En. date in the current month. It is not true HR net add (exits/leavers are not included). Optional monthly target is your run-rate goal.',
      bench:
        'Selection rate uses bench-interview rows with Feedback containing “selected” or “rejected” (denominator = that subset). Interview counts (MTD) are rows dated in the current month on bench- and market-interview sheets.',
    },
  };
}

module.exports = { buildBoardSummary };
