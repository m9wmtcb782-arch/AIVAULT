/**
 * Cross-dataset national fiscal risk linkage.
 * Deterministic screening only: no causal or legal conclusions.
 * Inputs must be pre-aligned to the same government scope, period, unit and accounting basis.
 */
const finite = v => typeof v === "number" && Number.isFinite(v);
const pctChange = (current, previous) =>
  finite(current) && finite(previous) && previous > 0 && current >= 0
    ? (current - previous) / previous * 100 : null;
const pct = (a, b) =>
  finite(a) && finite(b) && a >= 0 && b > 0 ? a / b * 100 : null;
const stableKey = r => [r.governmentScope, r.periodType, r.accountingBasis, r.unit]
  .map(v => String(v)).join("|");
const periodKey = r => String(r.period);
const refs = r => [...new Set([...(r.evidenceRefs ?? []), r.sourceId].filter(Boolean))];

function validateRows(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  const seen = new Set();
  for (const [i, r] of rows.entries()) {
    if (!r || typeof r !== "object" || Array.isArray(r))
      throw new TypeError(`Invalid fiscal observation at index ${i}`);
    if (![r.governmentScope, r.period, r.periodType, r.accountingBasis, r.unit]
      .every(v => typeof v === "string" && v.trim().length > 0))
      throw new TypeError(`Missing alignment key at index ${i}`);
    if (!/^\\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(r.period))
      throw new TypeError(`Invalid period label at index ${i}; expected YYYY or YYYY-MM`);
    for (const field of ["revenueBudget", "revenueActual", "expenditureActual", "debtOutstanding", "interestExpense"]) {
      if (r[field] !== null && r[field] !== undefined && !finite(r[field]))
        throw new TypeError(`Invalid numeric field ${field} at index ${i}`);
    }
    const key = `${stableKey(r)}|${periodKey(r)}`;
    if (seen.has(key)) throw new TypeError(`Duplicate government-period observation at index ${i}`);
    seen.add(key);
  }
}

function validateThresholds(options) {
  const thresholds = {
    revenueShortfallPct: options.revenueShortfallPct ?? 5,
    expenditureGrowthPct: options.expenditureGrowthPct ?? 10,
    debtGrowthPct: options.debtGrowthPct ?? 10,
    interestBurdenGrowthPct: options.interestBurdenGrowthPct ?? 10
  };
  for (const [name, value] of Object.entries(thresholds)) {
    if (!finite(value) || value < 0)
      throw new TypeError(`Invalid threshold ${name}; expected a finite non-negative number`);
  }
  return thresholds;
}

/**
 * One row per comparable government-period. Growth comparisons use the immediately
 * preceding supplied period within the same strict alignment group; periods must be
 * sortable YYYY or YYYY-MM labels. A missing calendar period is not imputed.
 */
export function analyzeFiscalRiskLinkages(rows, options = {}) {
  validateRows(rows);
  const thresholds = validateThresholds(options);
  const groups = new Map();
  for (const row of rows) {
    const key = stableKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const findings = [];
  for (const [alignmentKey, group] of groups) {
    const sorted = [...group].sort((a, b) => periodKey(a).localeCompare(periodKey(b), "en", { numeric: true }));
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i], previous = sorted[i - 1];
      const signals = [];
      const shortfall = finite(current.revenueBudget) && finite(current.revenueActual) && current.revenueBudget > 0
        ? (current.revenueActual - current.revenueBudget) / current.revenueBudget * 100 : null;
      if (shortfall !== null && shortfall <= -thresholds.revenueShortfallPct)
        signals.push({ code: "REVENUE_SHORTFALL", value: shortfall, threshold: -thresholds.revenueShortfallPct,
          explanation: "稅收實徵低於預算；須檢查預算編列、稅基變動及收入認列時點。" });
      const expenditureGrowth = previous ? pctChange(current.expenditureActual, previous.expenditureActual) : null;
      if (expenditureGrowth !== null && expenditureGrowth >= thresholds.expenditureGrowthPct)
        signals.push({ code: "EXPENDITURE_GROWTH", value: expenditureGrowth, threshold: thresholds.expenditureGrowthPct,
          explanation: "歲出較前一筆提供期間增加；須核對政策新增、一次性支出及預算執行。" });
      const debtGrowth = previous ? pctChange(current.debtOutstanding, previous.debtOutstanding) : null;
      if (debtGrowth !== null && debtGrowth >= thresholds.debtGrowthPct)
        signals.push({ code: "DEBT_GROWTH", value: debtGrowth, threshold: thresholds.debtGrowthPct,
          explanation: "公共債務未償餘額較前一筆提供期間增加；須核對舉債用途、還本及債務範圍。" });
      const currentBurden = pct(current.interestExpense, current.revenueActual);
      const previousBurden = previous ? pct(previous.interestExpense, previous.revenueActual) : null;
      const burdenGrowth = previousBurden !== null && currentBurden !== null
        ? pctChange(currentBurden, previousBurden) : null;
      if (burdenGrowth !== null && burdenGrowth >= thresholds.interestBurdenGrowthPct)
        signals.push({ code: "INTEREST_BURDEN_GROWTH", value: burdenGrowth, threshold: thresholds.interestBurdenGrowthPct,
          explanation: "利息支出占歲入比率較前一筆提供期間上升；須核對利率、到期結構、再融資及歲入變化。" });
      if (!signals.length) continue;
      const missing = ["revenueBudget", "revenueActual", "expenditureActual", "debtOutstanding", "interestExpense"]
        .filter(k => current[k] === null || current[k] === undefined);
      findings.push({
        findingId: `FISCAL-LINK-${encodeURIComponent(alignmentKey)}-${encodeURIComponent(current.period)}`,
        governmentScope: current.governmentScope, period: current.period, periodType: current.periodType,
        accountingBasis: current.accountingBasis, unit: current.unit, alignmentKey,
        state: "PENDING_AUDIT",
        classification: signals.length >= 2 ? "MULTI_SIGNAL_REVIEW" : "SINGLE_SIGNAL_REVIEW",
        // Research triage rank only; not a statutory or legal risk grade.
        riskLevel: signals.length >= 3 ? "HIGH" : signals.length === 2 ? "MEDIUM" : "LOW",
        signals, signalCount: signals.length,
        comparisonPeriod: previous?.period ?? null,
        metrics: { revenueShortfallPct: shortfall, expenditureGrowthPct: expenditureGrowth,
          debtGrowthPct: debtGrowth, interestBurdenPct: currentBurden, interestBurdenGrowthPct: burdenGrowth },
        missingMetrics: missing,
        dataStatus: missing.length ? "PARTIAL_DATA" : "COMPLETE_FOR_DEFINED_METRICS",
        evidenceRefs: [...new Set([...refs(current), ...(previous ? refs(previous) : [])])],
        trace: { currentPeriod: current.period, previousPeriod: previous?.period ?? null,
          comparisonRule: "same governmentScope + periodType + accountingBasis + unit; previous supplied period (not necessarily consecutive)",
          thresholds, causalInference: false },
        conclusion: "此為跨指標統計關聯查核線索，不代表因果關係、違法、舞弊或失職；須由審計人員核對原始憑證與政策背景。"
      });
    }
  }
  return findings;
}
