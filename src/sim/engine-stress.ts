/**
 * Engine stress test — hunts for correctness risks a tax product cannot ship.
 * Not a pass/fail unit test: it explores wide input ranges and REPORTS issues.
 *
 *   node src/sim/engine-stress.ts
 */
import { incomeTax } from "../engine/income-tax.ts";
import { detectScheme, presumptiveIncome } from "../engine/presumptive.ts";
import { estimateTax } from "../engine/index.ts";
import { FY_2025_26 } from "../engine/tax-rules/2025-26.ts";

const findings: string[] = [];
const ok: string[] = [];

// 1) Non-negativity + monotonicity over a dense grid (both regimes).
for (const regime of ["new", "old"] as const) {
  let prev = -1;
  let monoViol = 0;
  let negViol = 0;
  for (let inc = 0; inc <= 4_000_000; inc += 5_000) {
    const t = incomeTax(inc, regime).total;
    if (t < 0) negViol++;
    if (t < prev) monoViol++;
    prev = t;
  }
  if (negViol) findings.push(`[CRIT] ${regime} regime produced negative tax ${negViol}×`);
  if (monoViol) findings.push(`[CRIT] ${regime} regime non-monotonic (tax drops as income rises) ${monoViol}×`);
  if (!negViol && !monoViol) ok.push(`${regime} regime: non-negative + monotonic across 0–₹40L ✓`);
}

// 2) Rebate-boundary continuity — look for a "cliff" where earning ₹1 more costs ₹1000s.
{
  let worstCliff = 0;
  let cliffAt = 0;
  for (let inc = 1_150_000; inc <= 1_300_000; inc += 100) {
    const here = incomeTax(inc, "new").total;
    const next = incomeTax(inc + 100, "new").total;
    const extraTax = next - here; // tax on ₹100 more income
    if (extraTax > worstCliff) { worstCliff = extraTax; cliffAt = inc; }
  }
  // A real cliff would tax the marginal ₹100 by far more than ₹100.
  if (worstCliff > 100) {
    findings.push(`[HIGH] Rebate cliff near ₹${cliffAt.toLocaleString("en-IN")}: ₹100 more income adds ₹${worstCliff} tax (marginal-relief gap)`);
  } else {
    ok.push(`Rebate boundary ₹12L: smooth, marginal relief holds (max ₹100-step tax = ₹${worstCliff}) ✓`);
  }
}

// 3) Over-presumptive-limit understatement — the engine still applies presumptive
//    rate above the turnover cap, producing an artificially low tax.
{
  const overLimitDigital = 31_000_000; // > ₹3Cr 44AD digital cap
  const e = estimateTax({ profession: "wholesale trader", grossReceipts: overLimitDigital, incomeType: "BUSINESS" });
  if (!e.presumptiveApplicable && e.tax === null) {
    ok.push("Over-limit turnover: presumptive withheld (no false low tax), books/audit flagged ✓");
  } else if (e.tax && e.presumptive.rateApplied < 1) {
    findings.push(
      `[CRIT] Over-limit turnover ₹${overLimitDigital.toLocaleString("en-IN")} still taxed at presumptive ` +
      `${Math.round(e.presumptive.rateApplied * 100)}% → ₹${e.tax.total.toLocaleString("en-IN")} (understated)`,
    );
  }
}

// 4) Scheme-detection false positives — traders/shops whose names contain a
//    professional keyword get mis-flagged as 44ADA (50%) instead of 44AD (6/8%).
const TRADERS_THAT_SHOULD_BE_44AD = [
  "medical store", "designer clothes boutique", "IT hardware shop",
  "engineering goods trader", "film poster printing shop", "design stationery shop",
  "software CD reseller",
];
const misdetected = TRADERS_THAT_SHOULD_BE_44AD.filter((p) => detectScheme(p) === "44ADA");
if (misdetected.length) {
  findings.push(
    `[HIGH] Scheme mis-detection: ${misdetected.length}/${TRADERS_THAT_SHOULD_BE_44AD.length} traders flagged as 44ADA ` +
    `(50% vs correct 6/8%): ${misdetected.join(", ")}`,
  );
}

// 5) Cross-check a few headline cases still hold (regression guard).
{
  const dev = estimateTax({ profession: "freelance developer", grossReceipts: 1_800_000, incomeType: "PROFESSION" });
  if (dev.tax.total !== 0) findings.push(`[CRIT] Regression: ₹18L dev should be ₹0, got ₹${dev.tax.total}`);
  else ok.push("Regression: ₹18L freelance dev = ₹0 ✓");
}

console.log("=== ENGINE STRESS (FY" + FY_2025_26.financialYear + ") ===\n");
console.log("PASSED INVARIANTS:");
for (const o of ok) console.log("  ✓ " + o);
console.log("\nFINDINGS:");
if (findings.length === 0) console.log("  (none)");
for (const f of findings) console.log("  • " + f);
console.log(`\n${findings.length} issue(s) found.`);
