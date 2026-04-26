const { computeExtendedViews } = require('./bdOperationsViews.js');

/**
 * BD Operations Dashboard KPIs — replicates key formulas from
 * BD_Operations_Dashboard(1) Excel (Executive Summary + BD Funnel).
 *
 * Column refs match BD_DAR: Status = column "Status" (N in Excel);
 * Bench: Status in column "Status" (D); Bench Intv: Feedback column "Feedback".
 */

function monthWindow(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    start: new Date(y, m, 1, 0, 0, 0, 0),
    end: new Date(y, m + 1, 0, 23, 59, 59, 999),
  };
}

function inMonthRange(v, start, end) {
  if (v == null || v === '') return false;
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= start && dt <= end;
}

function countColANonEmpty(bd) {
  return bd.filter((r) => {
    const a = r['En. Date'] ?? r['En. Date '];
    return a !== null && a !== undefined && String(a).trim() !== '';
  }).length;
}

function st(r) {
  return String(r.Status ?? r.status ?? '').trim();
}

/** Top-line KPIs — Executive Summary row (matches Excel) */
function computeExecutiveSummary(bd, bench, benchIntv, marketIntv, now = new Date()) {
  const { start, end } = monthWindow(now);

  const totalSubmissions = countColANonEmpty(bd);

  const submissionsThisMonth = bd.filter((r) => inMonthRange(r['En. Date'] ?? r['En. Date '], start, end)).length;

  const onboarded = bd.filter((r) => st(r) === 'Onboarded').length;
  const onboarded_this_month = bd.filter(
    (r) => st(r) === 'Onboarded' && inMonthRange(r['En. Date'] ?? r['En. Date '], start, end)
  ).length;

  const submissionToOnboardPct = totalSubmissions > 0 ? onboarded / totalSubmissions : 0;

  const activePipelineStatuses = new Set([
    'Profile Shared',
    'Screening Scheduled',
    'Interview',
    'Shortlisted',
    'On Hold',
    'Awaiting Feedback',
    'Final Select',
  ]);
  const activePipeline = bd.filter((r) => activePipelineStatuses.has(st(r))).length;

  const benchRfd = bench.filter((r) => String(r.Status || r.status || '').trim() === 'RFD').length;

  const biRows = benchIntv.filter((r) => {
    const a = r.Date ?? r['Date'];
    return a !== null && a !== undefined && String(a).trim() !== '';
  });
  const mRows = marketIntv.filter((r) => {
    const a = r.Date ?? r['Date '];
    return a !== null && a !== undefined && String(a).trim() !== '';
  });
  const totalInterviews = biRows.length + mRows.length;

  let selected = 0;
  let rejected = 0;
  for (const r of biRows) {
    const fb = String(r.Feedback ?? r.feedback ?? '');
    if (/selected/i.test(fb)) selected += 1;
    else if (/rejected/i.test(fb)) rejected += 1;
  }
  const selectionRate = selected + rejected > 0 ? selected / (selected + rejected) : 0;

  return {
    total_submissions: totalSubmissions,
    submissions_this_month: submissionsThisMonth,
    onboarded,
    onboarded_this_month,
    submission_to_onboard_pct: submissionToOnboardPct,
    active_pipeline: activePipeline,
    bench_strength_rfd: benchRfd,
    total_interviews: totalInterviews,
    selection_rate_bench_interviews: selectionRate,
  };
}

function countStatus(bd, s) {
  return bd.filter((r) => st(r) === s).length;
}

/** BD Funnel — matches Excel "BD Funnel" tab counts */
function computeBdFunnel(bd) {
  const total = countColANonEmpty(bd);

  const survivedProfileScreening =
    total
    - countStatus(bd, 'Profile Rejected')
    - countStatus(bd, 'Lost / Deferred')
    - countStatus(bd, 'Requirement Received')
    - countStatus(bd, 'Requirement Shared');

  const reachedInterview =
    countStatus(bd, 'Profile Shared')
    + countStatus(bd, 'Awaiting Feedback')
    + countStatus(bd, 'Interview')
    + countStatus(bd, 'Screening Scheduled')
    + countStatus(bd, 'Shortlisted')
    + countStatus(bd, 'On Hold')
    + countStatus(bd, 'No Show')
    + countStatus(bd, 'Final Select')
    + countStatus(bd, 'Offer Rejected')
    + countStatus(bd, 'Onboarded');

  const clearedMultipleRounds =
    countStatus(bd, 'Shortlisted')
    + countStatus(bd, 'Final Select')
    + countStatus(bd, 'Offer Rejected')
    + countStatus(bd, 'Onboarded');

  const receivedOffer =
    countStatus(bd, 'Final Select')
    + countStatus(bd, 'Offer Rejected')
    + countStatus(bd, 'Onboarded');

  const acceptedOffer = countStatus(bd, 'Onboarded') + countStatus(bd, 'Final Select');

  const onboardedRevenue = countStatus(bd, 'Onboarded');

  const pTot = (n) => (total > 0 ? n / total : 0);
  // Excel: first funnel row "% of previous" equals "% of total"; each next row's previous = prior stage count
  return {
    total_submissions: { label: 'Total Submissions', count: total, pctOfTotal: 1, pctOfPrevious: null },
    survived_profile_screening: {
      label: 'Survived Profile Screening',
      count: survivedProfileScreening,
      pctOfTotal: pTot(survivedProfileScreening),
      pctOfPrevious: pTot(survivedProfileScreening),
    },
    reached_interview: {
      label: 'Reached Interview Stage',
      count: reachedInterview,
      pctOfTotal: pTot(reachedInterview),
      pctOfPrevious: survivedProfileScreening > 0 ? reachedInterview / survivedProfileScreening : 0,
    },
    cleared_multiple_rounds: {
      label: 'Cleared Multiple Rounds',
      count: clearedMultipleRounds,
      pctOfTotal: pTot(clearedMultipleRounds),
      pctOfPrevious: reachedInterview > 0 ? clearedMultipleRounds / reachedInterview : 0,
    },
    received_offer: {
      label: 'Received Offer',
      count: receivedOffer,
      pctOfTotal: pTot(receivedOffer),
      pctOfPrevious: clearedMultipleRounds > 0 ? receivedOffer / clearedMultipleRounds : 0,
    },
    accepted_offer: {
      label: 'Accepted Offer',
      count: acceptedOffer,
      pctOfTotal: pTot(acceptedOffer),
      pctOfPrevious: receivedOffer > 0 ? acceptedOffer / receivedOffer : 0,
    },
    onboarded_revenue: {
      label: 'Onboarded (Revenue)',
      count: onboardedRevenue,
      pctOfTotal: pTot(onboardedRevenue),
      pctOfPrevious: acceptedOffer > 0 ? onboardedRevenue / acceptedOffer : 0,
    },
  };
}

function computeAll(snapshot, now) {
  const bd = snapshot.bd || [];
  const bench = snapshot.bench || [];
  const benchIntv = snapshot.bench_interview || [];
  const marketIntv = snapshot.market_interview || [];
  return {
    executive: computeExecutiveSummary(bd, bench, benchIntv, marketIntv, now),
    funnel: computeBdFunnel(bd),
    row_counts: {
      bd: bd.length,
      bench: bench.length,
      bench_interview: benchIntv.length,
      market_interview: marketIntv.length,
    },
    views: computeExtendedViews(snapshot, now),
  };
}

module.exports = {
  computeExecutiveSummary,
  computeBdFunnel,
  computeAll,
  monthWindow,
};
