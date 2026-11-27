/**
 * AIVAULT National Fiscal Audit Engine (data-only module)
 * Deterministic analysis of public aggregate fiscal data.
 * No DOM, network, database, migration, or paid-AI dependencies.
 */
export const ENGINE_VERSION = "1.0.0";
export const REVIEW_STATES = Object.freeze({
  STATISTICAL_ANOMALY: "STATISTICAL_ANOMALY",
  AUDIT_LEAD: "PENDING_AUDIT",
  HUMAN_CONFIRMED: "HUMAN_CONFIRMED"
});

const first = (row, keys) => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  return undefined;
};
const number = (value, field) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[,，\s]/g, "").replace(/%$/, ""));
  if (!Number.isFinite(parsed)) throw new TypeError(`Invalid numeric field: ${field}`);
  return parsed;
};
const median = values => {
  const a = [...values].sort((x,y)=>x-y);
  if (!a.length) return 0;
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
};

/** Canonical record. Amounts remain in the source unit; never mix currencies/units. */
export function normalizeFiscalRecord(row, metadata = {}) {
  const year = number(first(row, ["year","年度","會計年度","日曆年"]), "year");
  const budget = number(first(row, ["budget","預算數","預算數(千元)","法定預算"]), "budget");
  const actualRaw = first(row, ["actual","實徵數","實徵淨額(千元)","決算數","實際數"]);
  const actual = actualRaw === undefined ? null : number(actualRaw, "actual");
  const unit = first(row, ["unit","單位"]) ?? metadata.unit ?? "SOURCE_UNIT_UNSPECIFIED";
  const tax = String(first(row, ["tax","稅目","項目別","收入科目"]) ?? "UNCLASSIFIED");
  const region = String(first(row, ["region","縣市別","機關別","政府別"]) ?? "NATIONAL");
  const agency = String(first(row, ["agency","機關","機關名稱"]) ?? "UNSPECIFIED");
  const sourceId = metadata.sourceId ?? row.sourceId ?? "UNSPECIFIED";
  const sourceUrl = metadata.sourceUrl ?? row.sourceUrl ?? null;
  const publishedAt = metadata.publishedAt ?? row.publishedAt ?? null;
  return { year, tax, region, agency, budget, actual, unit: String(unit), sourceId, sourceUrl, publishedAt,
    dataStatus: actual === null ? "BUDGET_ONLY" : "OBSERVED" };
}

export function normalizeFiscalDataset(rows, metadata = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  return rows.map(row => normalizeFiscalRecord(row, metadata));
}

export function budgetExecution(record) {
  if (record.actual === null || record.budget === 0) return {
    ...record, variance: null, varianceRate: null, executionRate: null,
    analysisStatus: record.actual === null ? "INSUFFICIENT_ACTUAL" : "ZERO_BUDGET"
  };
  const variance = record.actual - record.budget;
  return { ...record, variance, varianceRate: variance / Math.abs(record.budget) * 100,
    executionRate: record.actual / record.budget * 100, analysisStatus: "CALCULATED" };
}

export function compareAcrossYears(records, dimension = "tax") {
  const groups = new Map();
  for (const record of records) {
    const key = String(record[dimension] ?? "UNSPECIFIED");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].flatMap(([group, items]) => {
    const sorted = [...items].sort((a,b)=>a.year-b.year);
    return sorted.map((item, index) => {
      const previous = sorted[index-1];
      const growthRate = previous && previous.actual !== null && previous.actual !== 0 && item.actual !== null
        ? (item.actual - previous.actual) / Math.abs(previous.actual) * 100 : null;
      return { group, year:item.year, budget:item.budget, actual:item.actual, previousYear:previous?.year ?? null, growthRate, unit:item.unit };
    });
  });
}

export function compareDimensions(records, dimensions = ["tax","region"]) {
  const groups = new Map();
  for (const record of records) {
    if (record.actual === null) continue;
    const key = dimensions.map(d=>String(record[d] ?? "UNSPECIFIED")).join(" | ");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([group, items]) => {
    const actual = items.reduce((s,r)=>s+r.actual,0);
    const budget = items.reduce((s,r)=>s+r.budget,0);
    return { group, count:items.length, actual, budget, variance:actual-budget,
      executionRate:budget ? actual/budget*100 : null, unit:items[0].unit };
  });
}

/**
 * Detect unusual observations against comparable records only.
 * Groups must use same unit and same selected dimensions to avoid invalid comparisons.
 */
export function detectStatisticalAnomalies(records, options = {}) {
  const dimensions = options.dimensions ?? ["tax","region"];
  const minimumPeers = options.minimumPeers ?? 4;
  const zThreshold = options.zThreshold ?? 3.5;
  const groups = new Map();
  for (const r of records) {
    if (r.actual === null) continue;
    const key = [r.unit, ...dimensions.map(d=>String(r[d] ?? "UNSPECIFIED"))].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const findings = [];
  for (const [group, items] of groups) {
    for (const item of items) {
      const peers = items.filter(x=>x.year!==item.year).map(x=>x.actual);
      if (peers.length < minimumPeers) continue;
      const center = median(peers);
      const mad = median(peers.map(x=>Math.abs(x-center)));
      const robustZ = mad === 0 ? (item.actual === center ? 0 : Math.sign(item.actual-center)*Infinity)
        : 0.67448975*(item.actual-center)/mad;
      if (Math.abs(robustZ) >= zThreshold) findings.push({
        type:"ROBUST_DEVIATION", group, year:item.year, tax:item.tax, region:item.region,
        observed:item.actual, peerMedian:center, robustZ:Number.isFinite(robustZ)?robustZ:null,
        severity:Math.abs(robustZ)>=5?"HIGH":"MEDIUM",
        state:REVIEW_STATES.STATISTICAL_ANOMALY,
        explanation:"統計偏離；不是違法或舞弊認定。需先核對資料口徑、政策變動及一次性因素。",
        sourceId:item.sourceId, sourceUrl:item.sourceUrl
      });
    }
  }
  return findings;
}

export function scoreFiscalRisk({ executionRate, growthRate, debtRatio, dataCompleteness = 1 }) {
  let score = 0;
  const reasons = [];
  if (Number.isFinite(executionRate) && executionRate < 85) { score += Math.min(30, (85-executionRate)*1.2); reasons.push("預算執行率偏低"); }
  if (Number.isFinite(growthRate) && growthRate < -10) { score += Math.min(25, (Math.abs(growthRate)-10)*1.25); reasons.push("收入或實徵年增率顯著下降"); }
  if (Number.isFinite(debtRatio) && debtRatio > 40) { score += Math.min(30, (debtRatio-40)*1.5); reasons.push("債務比率偏高，須依適用法定口徑覆核"); }
  if (Number.isFinite(dataCompleteness) && dataCompleteness < 1) { score += (1-Math.max(0,dataCompleteness))*15; reasons.push("資料完整度不足，降低結論可信度"); }
  score = Math.round(Math.min(100, score)*10)/10;
  return { score, level:score>=70?"HIGH":score>=40?"MEDIUM":"LOW", reasons,
    state:REVIEW_STATES.AUDIT_LEAD, disclaimer:"風險分數為排序與預警用途，不是違法認定或正式審計結論。" };
}

export function buildAuditAnalysis(records, options = {}) {
  const normalized = records.map(r=>r.year !== undefined && r.dataStatus ? r : normalizeFiscalRecord(r, options.metadata));
  const execution = normalized.map(budgetExecution);
  return {
    engineVersion:ENGINE_VERSION, generatedAt:options.generatedAt ?? null,
    recordCount:normalized.length, records:execution,
    annualComparisons:compareAcrossYears(normalized,"tax"),
    regionalComparisons:compareDimensions(normalized,["year","region"]),
    anomalies:detectStatisticalAnomalies(normalized,options.anomalyOptions),
    methodology:{ currencyAndUnit:"原始單位保留；不同單位不得直接加總或比較",
      anomaly:"同稅目、地區及單位之歷年 robust MAD 偏離",
      humanReview:"統計異常 → 待查核線索 → 人工確認；不得自動升級為已確認問題" }
  };
}
