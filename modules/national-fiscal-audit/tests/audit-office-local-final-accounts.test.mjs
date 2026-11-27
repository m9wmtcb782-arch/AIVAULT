import test from "node:test";
import assert from "node:assert/strict";
import { mapAuditOfficeLocalFinalAccounts } from "../audit-office-local-final-accounts.js";

const source = {
  Government: "臺北市",
  FiscalYear: "113",
  Category: "REVENUE",
  FundCode: "01",
  AuthorityCode: "A01",
  AgencyCode: "A010",
  OperationPlanCode: "P01",
  WorkPlanCode: "W01",
  Account: "1",
  Sequence1: "01",
  Sequence2: "02",
  Sequence3: "03",
  Sequence4: "04",
  AccountTitle: "稅課收入",
  Budget: "1,000",
  Final_Realized: "900",
  Final_ReceivablePayable: "10",
  Final_Encumbrance: "5",
  Adjustment_Realized: "20",
  Adjustment_ReceivablePayable: "2",
  Adjustment_Encumbrance: "1",
  Audited_Realized: "880",
  Audited_ReceivablePayable: "12",
  Audited_Encumbrance: "6"
};

test("maps audit office local final-account stages without collapsing them", () => {
  const [r] = mapAuditOfficeLocalFinalAccounts([source], { unit: "新臺幣千元", rawSha256: "b".repeat(64) });
  assert.equal(r.governmentScope, "臺北市");
  assert.equal(r.fiscalYear, 113);
  assert.equal(r.periodType, "fiscal-year");
  assert.equal(r.budget, 1000);
  assert.equal(r.finalRealized, 900);
  assert.equal(r.adjustmentRealized, 20);
  assert.equal(r.auditedRealized, 880);
  assert.equal(r.unit, "新臺幣千元");
  assert.equal(r.accountingBasis, "local-government-final-account-audited");
  assert.equal(r.sourceDataset, "13979");
});

test("does not assume monetary unit when metadata omits it", () => {
  const [r] = mapAuditOfficeLocalFinalAccounts([source]);
  assert.equal(r.unit, null);
});

test("preserves missing amounts as null and rejects malformed amounts", () => {
  const [r] = mapAuditOfficeLocalFinalAccounts([{ ...source, Budget: "", Audited_Realized: null }]);
  assert.equal(r.budget, null);
  assert.equal(r.auditedRealized, null);
  assert.throws(() => mapAuditOfficeLocalFinalAccounts([{ ...source, Budget: "not-a-number" }]), /Invalid Budget/);
});

test("requires government, fiscal year and account title", () => {
  assert.throws(() => mapAuditOfficeLocalFinalAccounts([{ ...source, Government: "" }]), /Missing Government/);
  assert.throws(() => mapAuditOfficeLocalFinalAccounts([{ ...source, FiscalYear: "unknown" }]), /Invalid FiscalYear/);
  assert.throws(() => mapAuditOfficeLocalFinalAccounts([{ ...source, AccountTitle: null }]), /Missing AccountTitle/);
});
