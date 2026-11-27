/**
 * Explicit adapters for identified MOF/DGBAS open-data layouts.
 * Callers must supply the reporting year where the downloaded file omits it.
 */
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const val = (row, keys) => { for (const k of keys) if (own(row,k) && row[k] !== "" && row[k] != null) return row[k]; return null; };
const requiredYear = y => {
  const n=Number(y);
  if (!Number.isInteger(n) || n < 1900 || n > 2200) throw new TypeError("A valid reporting year is required");
  return n;
};
const cleanAmount = (v, field) => {
  if (v === null || v === undefined || v === "" || v === "-" || v === "—") return null;
  const n=Number(String(v).replace(/[,，\s]/g,""));
  if (!Number.isFinite(n)) throw new TypeError("Invalid amount in " + field + ": " + v);
  return n;
};
const provenance = (m) => ({
  sourceId:m.sourceId, sourceUrl:m.sourceUrl ?? null,
  publishedAt:m.publishedAt ?? null, downloadedAt:m.downloadedAt ?? null,
  rawSha256:m.rawSha256 ?? null, unit:m.unit ?? "新臺幣千元"
});

/** Dataset 16910: annual item-level actual net tax vs budget. Year is supplied by importer. */
export function mapMof16910(rows, metadata) {
  const year=requiredYear(metadata?.year);
  return rows.map((r,i)=>({
    year, tax:String(val(r,["項目別","稅目別","項目"]) ?? "UNCLASSIFIED"),
    region:"NATIONAL", agency:"NATIONAL_TAX_AUTHORITIES",
    budget:cleanAmount(val(r,["預算數(千元)","預算數","預算"]),`row ${i} budget`),
    actual:cleanAmount(val(r,["實徵淨額(千元)","實徵淨額","實徵數"]),`row ${i} actual`),
    unit:metadata.unit ?? "新臺幣千元", sourceId:metadata.sourceId ?? "MOF-16910",
    sourceUrl:metadata.sourceUrl ?? null, publishedAt:metadata.publishedAt ?? null,
    downloadedAt:metadata.downloadedAt ?? null, rawSha256:metadata.rawSha256 ?? null,
    sourceDataset:"16910", recordType:"TAX_BUDGET_ACTUAL"
  }));
}

/** Dataset 46025: VAT annual time series. It is national VAT, not regional tax. */
export function mapDot46025(rows, metadata) {
  return rows.map((r,i)=>({
    year:requiredYear(val(r,["年度","年別","會計年度"])),
    tax:"營業稅", region:"NATIONAL", agency:"NATIONAL_TAX_AUTHORITIES",
    budget:cleanAmount(val(r,["預算數(新臺幣千元)","預算數(千元)","預算數"]),`row ${i} budget`),
    actual:cleanAmount(val(r,["實徵數(新臺幣千元)","實徵數(千元)","實徵數"]),`row ${i} actual`),
    unit:metadata.unit ?? "新臺幣千元", sourceId:metadata.sourceId ?? "DOT-46025",
    sourceUrl:metadata.sourceUrl ?? null, publishedAt:metadata.publishedAt ?? null,
    downloadedAt:metadata.downloadedAt ?? null, rawSha256:metadata.rawSha256 ?? null,
    sourceDataset:"46025", recordType:"TAX_BUDGET_ACTUAL"
  }));
}

/**
 * Datasets 6741/6742 are wide annual tax tables.
 * The data.gov.tw metadata lists agency/region plus tax columns; provide the year explicitly.
 * Subtotals and total are marked AGGREGATE to prevent accidental double counting.
 */
export function mapMofWideTaxRows(rows, metadata) {
  const year=requiredYear(metadata?.year);
  const dimension=metadata.dimension;
  if (!["agency","region"].includes(dimension)) throw new TypeError("dimension must be agency or region");
  const dimensionKeys=dimension==="agency"?["機關別","機關名稱"]:["地區別","縣市別"];
  const idColumns=new Set([...dimensionKeys,"年度","年別","單位"]);
  const aggregateNames=new Set(["總計","所得稅小計","土地稅小計"]);
  return rows.flatMap((row,ri)=>{
    const label=val(row,dimensionKeys);
    if (!label) throw new TypeError(`Missing ${dimension} label at row ${ri}`);
    return Object.keys(row).filter(k=>!idColumns.has(k)).flatMap(tax=>{
      const amount=cleanAmount(row[tax],`row ${ri} ${tax}`);
      if (amount===null) return [];
      return [{
        year,tax,region:dimension==="region"?String(label):"NATIONAL",
        agency:dimension==="agency"?String(label):"UNSPECIFIED",
        budget:null,actual:amount,unit:metadata.unit ?? "新臺幣千元",
        sourceId:metadata.sourceId ?? (dimension==="agency"?"MOF-6741":"MOF-6742"),
        sourceUrl:metadata.sourceUrl ?? null,publishedAt:metadata.publishedAt ?? null,
        downloadedAt:metadata.downloadedAt ?? null,rawSha256:metadata.rawSha256 ?? null,
        sourceDataset:dimension==="agency"?"6741":"6742",
        recordType:aggregateNames.has(tax)?"AGGREGATE":"TAX_ACTUAL"
      }];
    });
  });
}
