/**
 * Adapters for Taiwan MOF Treasury public-debt open datasets.
 * Dataset 30955 = actual; 30956 = budget. Amounts are NTD 100M (億元).
 * Preserve official ratios/flags as published; never recalculate statutory limits
 * unless the legal denominator, period and government scope are verified.
 */
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const pick=(row,keys)=>{for(const k of keys)if(own(row,k)&&row[k]!==""&&row[k]!==null&&row[k]!==undefined)return row[k];return null;};
const amount=(v,name)=>{
  if(v===null||v===undefined||v===""||v==="-"||v==="—")return null;
  const n=Number(String(v).replace(/[,，\s]/g,""));
  if(!Number.isFinite(n))throw new TypeError(`Invalid ${name}: ${v}`);
  return n;
};
const pct=(v,name)=>amount(v,name);
const metadata=(m,id)=>({
  sourceId:m.sourceId??id,sourceDataset:id,sourceUrl:m.sourceUrl??null,
  publishedAt:m.publishedAt??null,downloadedAt:m.downloadedAt??null,
  rawSha256:m.rawSha256??null,unit:"新臺幣億元",periodType:"monthly"
});
function mapDebt(rows,m,id,kind){
  if(!Array.isArray(rows))throw new TypeError("rows must be an array");
  return rows.map((r,i)=>{
    const year=amount(pick(r,["資料所屬年度","年度","年"]),`row ${i} year`);
    const month=amount(pick(r,["資料所屬截止月份","截止月份","月份"]),`row ${i} month`);
    const governmentScope=String(pick(r,["政府別","政府機關別"])??"UNSPECIFIED");
    if(year===null||month===null)throw new TypeError(`Missing debt period at row ${i}`);
    return {
      year,month,period:`${year}-${String(month).padStart(2,"0")}`,
      periodType:"monthly",governmentScope,indicator:"PUBLIC_DEBT",
      debtOutstanding:amount(pick(r,["債務未償餘額_新臺幣億元","債務未償餘額","1年以上未償債務餘額_新臺幣億元","1年以上未償債務餘額_新臺幣億元"]),`row ${i} debtOutstanding`),
      annualBorrowing:amount(pick(r,kind==="actual"?["當年度實際舉債數_新臺幣億元","當年度實際舉債數"]:["當年度預算編列舉債數_新臺幣億元","當年度預算編列舉債數"]),`row ${i} annualBorrowing`),
      expenditure:amount(pick(r,["歲出(不含保留數)_新臺幣億元","歲出(不含保留數)"]),`row ${i} expenditure`),
      expenditureIncludingReserves:amount(pick(r,["歲出(含保留數)_新臺幣億元","歲出(含保留數)"]),`row ${i} expenditureIncludingReserves`),
      debtLimit:amount(pick(r,["當年度舉債額度上限金額_新臺幣億元","當年度舉債上限金額_新臺幣億元"]),`row ${i} debtLimit`),
      exceedsLimit:pick(r,["當年度舉債額度超限註記","當年度舉債超限註記"]),
      debtToExpenditureRate:pct(pick(r,["未償餘額/歲出比率_百分比","未償餘額/歲出比率"]),`row ${i} debtToExpenditureRate`),
      statutoryDebtToExpenditureRate:pct(pick(r,["未償餘額/歲出法定比率_百分比","未償餘額/歲出法定比率"]),`row ${i} statutoryDebtToExpenditureRate`),
      debtToThreeYearAverageGdpRate:pct(pick(r,["未償餘額/前3年度GDP平均數比率_百分比","未償餘額/前3年度GDP平均數比率"]),`row ${i} debtToThreeYearAverageGdpRate`),
      statutoryDebtToThreeYearAverageGdpRate:pct(pick(r,["未償餘額/前3年度GDP平均數法定比率_百分比","未償餘額/前3年度GDP平均數法定比率"]),`row ${i} statutoryDebtToThreeYearAverageGdpRate`),
      dataKind:kind,...metadata(m,id)
    };
  });
}
export const mapPublicDebtActual=(rows,m={})=>mapDebt(rows,m,"MOF-30955","actual");
export const mapPublicDebtBudget=(rows,m={})=>mapDebt(rows,m,"MOF-30956","budget");

/** Dataset 25299: national debt clock monthly series, central government only. */
export function mapNationalDebtClock(rows,m={}){
  if(!Array.isArray(rows))throw new TypeError("rows must be an array");
  return rows.map((r,i)=>{
    const date=String(pick(r,["日期","年月","年月別"])??"");
    if(!/^\d{4}[-年/ ]?\d{1,2}/.test(date))throw new TypeError(`Invalid debt-clock date at row ${i}`);
    return {
      date,period:date,periodType:"monthly",governmentScope:"CENTRAL",
      longTermDebt:amount(pick(r,["中央政府1年以上債務未償餘額_新臺幣億元","中央政府1年以上債務未償餘額"]),`row ${i} longTermDebt`),
      shortTermDebt:amount(pick(r,["中央政府短期債務未償餘額_新臺幣億元","中央政府短期債務未償餘額"]),`row ${i} shortTermDebt`),
      population:amount(pick(r,["臺灣人口數_人","人口數"]),`row ${i} population`),
      perCapitaDebt:amount(pick(r,["人均負擔債務_新臺幣萬元","平均每人負擔債務"]),`row ${i} perCapitaDebt`),
      ...metadata(m,"MOF-25299")
    };
  });
}
