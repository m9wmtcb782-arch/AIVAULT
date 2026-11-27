/**
 * National Audit Office dataset 13979:
 * Local-government final accounts (revenue/expenditure) audited data.
 * Preserve each accounting stage separately; do not infer unit or category semantics.
 */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const pick = (row, keys) => {
  for (const key of keys) if (own(row, key) && row[key] !== "" && row[key] !== null && row[key] !== undefined) return row[key];
  return null;
};
const numberOrNull = (value, field, rowIndex) => {
  if (value === null || value === undefined || value === "" || value === "-" || value === "—") return null;
  const n = Number(String(value).replace(/[,，\s]/g, ""));
  if (!Number.isFinite(n)) throw new TypeError(`Invalid ${field} at row ${rowIndex}`);
  return n;
};
const yearValue = (value, i) => {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1 || year > 2200) throw new TypeError(`Invalid FiscalYear at row ${i}`);
  // Dataset 13979 uses Taiwan ROC fiscal-year labels (e.g. 113); normalize to Gregorian
  // for period alignment while retaining the exact source year below.
  return year < 300 ? year + 1911 : year;
};

/**
 * metadata.unit must be supplied by a verified data dictionary before monetary
 * aggregation. The adapter deliberately does not assume NTD, thousand NTD or any
 * other scale from the field names.
 */
export function mapAuditOfficeLocalFinalAccounts(rows, metadata = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  if (metadata.unit !== undefined && (typeof metadata.unit !== "string" || !metadata.unit.trim()))
    throw new TypeError("metadata.unit must be a non-empty string when supplied");
  return rows.map((row, i) => {
    const government = pick(row, ["Government"]);
    const accountTitle = pick(row, ["AccountTitle"]);
    if (government === null || String(government).trim() === "") throw new TypeError(`Missing Government at row ${i}`);
    if (accountTitle === null || String(accountTitle).trim() === "") throw new TypeError(`Missing AccountTitle at row ${i}`);
    return {
      governmentScope: String(government),
      sourceFiscalYear: Number(pick(row, ["FiscalYear"])),
      fiscalYear: yearValue(pick(row, ["FiscalYear"]), i),
      period: String(yearValue(pick(row, ["FiscalYear"]), i)),
      periodType: "fiscal-year",
      categoryCode: pick(row, ["Category"]),
      fundCode: pick(row, ["FundCode"]),
      authorityCode: pick(row, ["AuthorityCode"]),
      agencyCode: pick(row, ["AgencyCode"]),
      operationPlanCode: pick(row, ["OperationPlanCode"]),
      workPlanCode: pick(row, ["WorkPlanCode"]),
      accountCode: pick(row, ["Account"]),
      sequence: [pick(row, ["Sequence1"]), pick(row, ["Sequence2"]), pick(row, ["Sequence3"]), pick(row, ["Sequence4"])],
      accountTitle: String(accountTitle),
      budget: numberOrNull(pick(row, ["Budget"]), "Budget", i),
      finalRealized: numberOrNull(pick(row, ["Final_Realized"]), "Final_Realized", i),
      finalReceivablePayable: numberOrNull(pick(row, ["Final_ReceivablePayable"]), "Final_ReceivablePayable", i),
      finalEncumbrance: numberOrNull(pick(row, ["Final_Encumbrance"]), "Final_Encumbrance", i),
      adjustmentRealized: numberOrNull(pick(row, ["Adjustment_Realized"]), "Adjustment_Realized", i),
      adjustmentReceivablePayable: numberOrNull(pick(row, ["Adjustment_ReceivablePayable"]), "Adjustment_ReceivablePayable", i),
      adjustmentEncumbrance: numberOrNull(pick(row, ["Adjustment_Encumbrance"]), "Adjustment_Encumbrance", i),
      auditedRealized: numberOrNull(pick(row, ["Audited_Realized"]), "Audited_Realized", i),
      auditedReceivablePayable: numberOrNull(pick(row, ["Audited_ReceivablePayable"]), "Audited_ReceivablePayable", i),
      auditedEncumbrance: numberOrNull(pick(row, ["Audited_Encumbrance"]), "Audited_Encumbrance", i),
      unit: metadata.unit ?? null,
      accountingBasis: "local-government-final-account-audited",
      sourceId: metadata.sourceId ?? "NAO-13979",
      sourceDataset: "13979",
      sourceUrl: metadata.sourceUrl ?? "https://data.gov.tw/dataset/13979",
      publishedAt: metadata.publishedAt ?? null,
      downloadedAt: metadata.downloadedAt ?? null,
      rawSha256: metadata.rawSha256 ?? null,
      sourceRow: i
    };
  });
}
