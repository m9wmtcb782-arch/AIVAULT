import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFiscalRiskLinkages } from "../fiscal-risk-linkage.js";

const base = { governmentScope: "中央政府", periodType: "calendar-year", accountingBasis: "final-actual", unit: "億元" };

test("links four fiscal signals with traceable evidence", () => {
  const rows = [
    { ...base, period: "2023", revenueBudget: 1000, revenueActual: 1000, expenditureActual: 900, debtOutstanding: 500, interestExpense: 20, sourceId: "S23" },
    { ...base, period: "2024", revenueBudget: 1000, revenueActual: 900, expenditureActual: 1100, debtOutstanding: 600, interestExpense: 30, sourceId: "S24" }
  ];
  const [x] = analyzeFiscalRiskLinkages(rows);
  assert.equal(x.state, "PENDING_AUDIT");
  assert.equal(x.signalCount, 4);
  assert.equal(x.riskLevel, "HIGH");
  assert.deepEqual(x.evidenceRefs, ["S24", "S23"]);
  assert.equal(x.trace.causalInference, false);
  assert.equal(x.comparisonPeriod, "2023");
  assert.match(x.findingId, /^FISCAL-LINK-/);
});

test("does not compare across government scope, unit, accounting basis or period type", () => {
  const rows = [
    { ...base, period: "2023", revenueBudget: 100, revenueActual: 100, expenditureActual: 100, debtOutstanding: 100, interestExpense: 1 },
    { ...base, period: "2024", governmentScope: "地方政府", revenueBudget: 100, revenueActual: 100, expenditureActual: 200, debtOutstanding: 200, interestExpense: 2 },
    { ...base, period: "2024", unit: "千元", revenueBudget: 100, revenueActual: 100, expenditureActual: 200, debtOutstanding: 200, interestExpense: 2 },
    { ...base, period: "2024", accountingBasis: "budget", revenueBudget: 100, revenueActual: 100, expenditureActual: 200, debtOutstanding: 200, interestExpense: 2 },
    { ...base, period: "2024", periodType: "fiscal-year", revenueBudget: 100, revenueActual: 100, expenditureActual: 200, debtOutstanding: 200, interestExpense: 2 }
  ];
  assert.deepEqual(analyzeFiscalRiskLinkages(rows), []);
});

test("missing metrics are explicit and are never imputed", () => {
  const rows = [{ ...base, period: "2024", revenueBudget: 100, revenueActual: 80, expenditureActual: null, debtOutstanding: null, interestExpense: null }];
  const [x] = analyzeFiscalRiskLinkages(rows);
  assert.equal(x.dataStatus, "PARTIAL_DATA");
  assert.ok(x.missingMetrics.includes("debtOutstanding"));
  assert.equal(x.metrics.debtGrowthPct, null);
});

test("thresholds are configurable research screening rules, not legal limits", () => {
  const rows = [{ ...base, period: "2024", revenueBudget: 100, revenueActual: 96, expenditureActual: 100, debtOutstanding: 100, interestExpense: 1 }];
  assert.equal(analyzeFiscalRiskLinkages(rows).length, 0);
  assert.equal(analyzeFiscalRiskLinkages(rows, { revenueShortfallPct: 3 }).length, 1);
});

test("rejects invalid thresholds, malformed periods and duplicate group-period observations", () => {
  const row = { ...base, period: "2024", revenueBudget: 100, revenueActual: 100, expenditureActual: 100, debtOutstanding: 100, interestExpense: 1 };
  assert.throws(() => analyzeFiscalRiskLinkages([row], { debtGrowthPct: -1 }), /Invalid threshold/);
  assert.throws(() => analyzeFiscalRiskLinkages([{ ...row, period: "2024-13" }]), /Invalid period label/);
  assert.throws(() => analyzeFiscalRiskLinkages([row, row]), /Duplicate government-period/);
});

test("does not calculate growth from zero or negative prior-period bases", () => {
  const rows = [
    { ...base, period: "2023", revenueBudget: 100, revenueActual: 100, expenditureActual: 0, debtOutstanding: 0, interestExpense: 0 },
    { ...base, period: "2024", revenueBudget: 100, revenueActual: 100, expenditureActual: 100, debtOutstanding: 100, interestExpense: 1 }
  ];
  const [x] = analyzeFiscalRiskLinkages(rows);
  assert.equal(x.metrics.expenditureGrowthPct, null);
  assert.equal(x.metrics.debtGrowthPct, null);
  assert.equal(x.metrics.interestBurdenGrowthPct, null);
});
