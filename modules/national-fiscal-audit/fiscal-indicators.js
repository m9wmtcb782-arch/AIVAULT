/**
 * National fiscal indicators.
 * Inputs must already share a declared accounting basis, period, currency and unit.
 * Missing denominators return null; the module never estimates or invents them.
 */
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const ratio = (numerator, denominator) =>
  finite(numerator) && finite(denominator) && denominator !== 0
    ? numerator / denominator * 100 : null;

function requireSameBasis(items, fields) {
  for (const field of fields) {
    const values = new Set(items.map(x => x[field]).filter(v => v !== undefined && v !== null));
    if (values.size > 1) throw new TypeError(`Mixed fiscal basis: ${field}`);
  }
}

/** Revenue-expenditure balance; all amounts must use the same period/unit/basis. */
export function calculateFiscalBalance({ revenue, expenditure, unit, period, accountingBasis }) {
  if (!finite(revenue) || !finite(expenditure)) {
    return { balance: null, balanceRate: null, status: "INSUFFICIENT_DATA", unit: unit ?? null, period: period ?? null };
  }
  return {
    balance: revenue - expenditure,
    balanceRate: ratio(revenue - expenditure, revenue),
    status: "CALCULATED",
    unit: unit ?? null,
    period: period ?? null,
    accountingBasis: accountingBasis ?? null
  };
}

/** Debt/GDP. Numerator and denominator must be same government scope and period. */
export function calculateDebtToGDP({ debt, gdp, unit, period, governmentScope, accountingBasis }) {
  const value = ratio(debt, gdp);
  return {
    value,
    status: value === null ? "INSUFFICIENT_OR_ZERO_DENOMINATOR" : "CALCULATED",
    unit: unit ?? null, period: period ?? null,
    governmentScope: governmentScope ?? null,
    accountingBasis: accountingBasis ?? null
  };
}

/** Interest/revenue burden. Does not assume a statutory warning threshold. */
export function calculateInterestBurden({ interestExpense, revenue, unit, period, governmentScope, accountingBasis }) {
  const value = ratio(interestExpense, revenue);
  return {
    value,
    status: value === null ? "INSUFFICIENT_OR_ZERO_DENOMINATOR" : "CALCULATED",
    unit: unit ?? null, period: period ?? null,
    governmentScope: governmentScope ?? null,
    accountingBasis: accountingBasis ?? null
  };
}

/**
 * Compare annual fiscal observations only when units and accounting bases agree.
 * Period labels are kept as supplied; callers must not mix calendar and fiscal years.
 */
export function compareFiscalPeriods(records, dimensions = ["governmentScope", "indicator"]) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const groups = new Map();
  for (const row of records) {
    if (!finite(row.value)) continue;
    const key = [row.unit ?? "UNIT_UNSPECIFIED", row.periodType ?? "PERIOD_UNSPECIFIED",
      row.accountingBasis ?? "BASIS_UNSPECIFIED",
      ...dimensions.map(d => String(row[d] ?? "UNSPECIFIED"))].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].flatMap(([group, rows]) => {
    const sorted = [...rows].sort((a,b)=>String(a.period).localeCompare(String(b.period), "en", {numeric:true}));
    return sorted.map((row, index) => {
      const previous = sorted[index-1];
      return {
        group, period: row.period, value: row.value,
        previousPeriod: previous?.period ?? null,
        changeRate: previous && previous.value !== 0 ? (row.value-previous.value)/Math.abs(previous.value)*100 : null,
        unit: row.unit ?? null, periodType: row.periodType ?? null,
        accountingBasis: row.accountingBasis ?? null
      };
    });
  });
}

/** Validate that a set of amounts is safe to aggregate under declared dimensions. */
export function sumFiscalAmounts(records, dimensions = []) {
  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  const groups = new Map();
  for (const row of records) {
    if (!finite(row.amount)) continue;
    const key = [row.unit ?? "UNIT_UNSPECIFIED", row.periodType ?? "PERIOD_UNSPECIFIED",
      row.accountingBasis ?? "BASIS_UNSPECIFIED",
      ...dimensions.map(d=>String(row[d] ?? "UNSPECIFIED"))].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([group, rows]) => ({
    group, amount: rows.reduce((sum,row)=>sum+row.amount,0), count: rows.length,
    unit: rows[0].unit ?? null, periodType: rows[0].periodType ?? null,
    accountingBasis: rows[0].accountingBasis ?? null
  }));
}
