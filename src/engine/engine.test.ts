/**
 * Trust-critical engine tests (FY2025-26). These encode the exact cases the
 * sandbox user-testing surfaced — especially the §87A-on-net rebate (TAX-04),
 * which is the difference between over-taxing a freelancer by ₹1.66L and ₹0.
 *
 * Run: node --test src/engine/engine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  incomeTax,
  detectScheme,
  presumptiveIncome,
  gstOnInvoice,
  gstRegistrationRequired,
  gstLiability,
  itcStatus,
  advanceTaxDue,
  estimateTax,
} from "./index.ts";

test("new regime: ₹9L taxable → ₹0 via §87A rebate", () => {
  assert.equal(incomeTax(900_000, "new").total, 0);
});

test("new regime: ₹15L → ₹105,000 tax + 4% cess = ₹109,200", () => {
  const t = incomeTax(1_500_000, "new");
  assert.equal(t.taxBeforeCess, 105_000);
  assert.equal(t.total, 109_200);
});

test("new regime: ₹25L exercises the 25% slab band", () => {
  // 0 + 20k + 40k + 60k + 80k + 100k + 30k = 330,000 ; +4% cess = 343,200
  const t = incomeTax(2_500_000, "new");
  assert.equal(t.taxBeforeCess, 330_000);
  assert.equal(t.total, 343_200);
});

test("new regime: ₹8L → ₹0 (within ₹12L rebate limit)", () => {
  assert.equal(incomeTax(800_000, "new").total, 0);
});

test("old regime: ₹5L → ₹0 via §87A", () => {
  assert.equal(incomeTax(500_000, "old").total, 0);
});

test("engine never emits NaN/Infinity from bad input", () => {
  assert.equal(incomeTax(NaN, "new").total, 0);
  assert.equal(incomeTax(Infinity, "new").taxableIncome, 0);
  const e = estimateTax({ profession: "dev", grossReceipts: NaN, incomeType: "PROFESSION" });
  assert.equal(e.presumptive.presumptiveIncome, 0);
  assert.equal(e.tax?.total, 0);
});

test("TAX-04: ₹18L gross 44ADA professional → ₹9L net → ₹0 tax", () => {
  const p = presumptiveIncome(1_800_000, "44ADA");
  assert.equal(p.presumptiveIncome, 900_000);
  assert.equal(incomeTax(p.presumptiveIncome, "new").total, 0);
});

test("scheme detection: kirana store → 44AD, doctor → 44ADA", () => {
  assert.equal(detectScheme("Kirana store owner"), "44AD");
  assert.equal(detectScheme("Doctor with private practice"), "44ADA");
});

test("scheme detection: 'Rapido bike taxi captain' must NOT match 'ca' → 44AD", () => {
  assert.equal(detectScheme("Rapido bike taxi captain"), "44AD");
});

test("44AD trader ₹60L digital → 6% = ₹3.6L net", () => {
  assert.equal(presumptiveIncome(6_000_000, "44AD", true).presumptiveIncome, 360_000);
});

test("estimateTax end-to-end: ₹18L freelance dev → ₹0", () => {
  const e = estimateTax({
    profession: "Freelance software developer",
    grossReceipts: 1_800_000,
    incomeType: "PROFESSION",
  });
  assert.equal(e.presumptive.scheme, "44ADA");
  assert.equal(e.tax.total, 0);
  assert.equal(e.auditWarning, null);
});

test("estimateTax: ₹40L doctor → ₹20L net → real tax (₹2,08,000)", () => {
  const e = estimateTax({
    profession: "Doctor private practice",
    grossReceipts: 4_000_000,
    incomeType: "PROFESSION",
  });
  assert.equal(e.presumptive.scheme, "44ADA");
  assert.equal(e.presumptive.presumptiveIncome, 2_000_000);
  // ₹20L new-regime: 0+20k+40k+60k+80k = 200,000 ; +4% cess = 208,000
  assert.equal(e.tax.total, 208_000);
});

test("audit warning fires above the 44ADA limit", () => {
  const e = estimateTax({
    profession: "Consultant",
    grossReceipts: 80_000_000,
    incomeType: "PROFESSION",
  });
  assert.equal(e.presumptive.withinLimit, false);
  assert.ok(e.auditWarning?.includes("exceeds"));
});

test("GST: intra-state ₹50k → ₹9,000 (CGST+SGST)", () => {
  assert.equal(gstOnInvoice({ amount: 50_000, intraState: true }).totalGst, 9_000);
});

test("GST: export with LUT → 0; without LUT → 18% IGST", () => {
  assert.equal(gstOnInvoice({ amount: 100_000, intraState: false, isExport: true, hasLut: true }).totalGst, 0);
  assert.equal(gstOnInvoice({ amount: 100_000, intraState: false, isExport: true, hasLut: false }).totalGst, 18_000);
});

test("GST registration: ₹60L goods turnover → required", () => {
  assert.equal(gstRegistrationRequired(6_000_000, true).required, true);
});

test("GST liability: output − input netting (and carry-forward)", () => {
  assert.equal(gstLiability({ outputGst: 100_000, inputGstEligible: 60_000 }).netPayable, 40_000);
  const refund = gstLiability({ outputGst: 50_000, inputGstEligible: 80_000 });
  assert.equal(refund.netPayable, 0);
  assert.equal(refund.carryForward, 30_000);
});

test("ITC: §17(5) blocked, business eligible, personal/unknown NOT eligible (safe default)", () => {
  assert.equal(itcStatus("restaurant lunch", true).status, "blocked");
  assert.equal(itcStatus("Figma software subscription", true).eligible, true);
  assert.equal(itcStatus("software", false).status, "review"); // no invoice
  // B1 fix: personal spend with an invoice is NOT auto-eligible
  assert.equal(itcStatus("household groceries", true).eligible, false);
  assert.equal(itcStatus("transportation", true).eligible, false);
  // unknown/dual-use → review, never silently claimed
  assert.equal(itcStatus("misc subscription", true).status, "review");
});

test("advance tax: <₹10k not required; presumptive pays 100% by 15 Mar", () => {
  assert.equal(advanceTaxDue(5_000, false).required, false);
  const a = advanceTaxDue(50_000, true);
  assert.equal(a.schedule.length, 1);
  assert.equal(a.schedule[0]?.dueDate, "15 Mar");
});
