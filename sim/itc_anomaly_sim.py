"""
Real-data simulation: run actual Indian household transactions through TaxEasy's
ITC (§17(5)) classifier + anomaly logic to surface product risks.

Data: Kaggle 'Daily Household Transactions' (already local in the sandbox).
Pandas-only (no sklearn). Reports coverage gaps + anomaly false-positive pressure.
"""
import sys
import pandas as pd
import numpy as np

DATA = "/home/ritesh/Downloads/TaxEasy-sandbox-usertest/ml/data/Daily Household Transactions.csv"

# Mirror of src/engine/itc.ts ITC_BLOCKED (§17(5) keywords).
ITC_BLOCKED = ["restaurant", "food", "beverage", "hotel", "lodging", "club", "gym",
               "fitness", "personal", "salon", "spa", "motor_vehicle", "car",
               "fuel_personal", "gift"]

def itc_status(category: str) -> str:
    cat = str(category).lower()
    if any(b in cat for b in ITC_BLOCKED):
        return "BLOCKED"
    return "ELIGIBLE"   # our engine defaults non-blocked to eligible

df = pd.read_csv(DATA)
df.columns = [c.strip() for c in df.columns]
exp = df[df["Income/Expense"].str.strip().str.lower() == "expense"].copy()
exp["Amount"] = pd.to_numeric(exp["Amount"], errors="coerce")
exp = exp.dropna(subset=["Amount"])
exp["Date"] = pd.to_datetime(exp["Date"], format="%d/%m/%Y %H:%M:%S", errors="coerce")

print(f"=== REAL-DATA ITC + ANOMALY SIM ===")
print(f"expense rows: {len(exp)} | distinct categories: {exp['Category'].nunique()}\n")

# --- ITC classification on real categories ---
cats = exp["Category"].fillna("").str.lower()
exp["itc"] = exp["Category"].apply(itc_status)
blocked = (exp["itc"] == "BLOCKED").sum()
eligible = (exp["itc"] == "ELIGIBLE").sum()

# Coverage risk: how many ELIGIBLE are actually personal/non-business (false ITC)?
# Heuristic personal categories present in this real dataset:
PERSONAL_HINTS = ["household", "subscription", "transportation", "investment",
                  "money transfer", "education", "health", "festival", "apparel",
                  "tourism", "culture", "family", "maid", "rent", "self-development"]
likely_personal = exp[(exp["itc"] == "ELIGIBLE") &
                      (cats.apply(lambda c: any(h in c for h in PERSONAL_HINTS)))]
print("ITC CLASSIFICATION:")
print(f"  blocked (§17(5)): {blocked}  |  eligible (default): {eligible}")
print(f"  ⚠️  eligible-but-likely-personal (false-ITC risk): {len(likely_personal)} "
      f"({100*len(likely_personal)/max(eligible,1):.1f}% of 'eligible')")
top_false = likely_personal["Category"].value_counts().head(6)
print("  top false-ITC categories:")
for k, v in top_false.items():
    print(f"     {k}: {v}")

# --- Category coverage: how 'readable' are real notes for AI categorization? ---
notes = exp["Note"].fillna("").astype(str)
short_notes = (notes.str.len() <= 3).sum()
print(f"\nCATEGORIZATION DIFFICULTY:")
print(f"  uninformative notes (<=3 chars): {short_notes} ({100*short_notes/len(exp):.1f}%)")
print(f"  distinct subcategories: {exp['Subcategory'].nunique()}")

# --- Anomaly logic: per-category >3σ + duplicate (same amt+cat within 7 days) ---
flagged_sigma = 0
for cat, g in exp.groupby("Category"):
    a = g["Amount"].to_numpy(dtype=float)
    if len(a) < 5:
        continue
    mu, sd = a.mean(), a.std(ddof=0)
    if sd == 0:
        continue
    flagged_sigma += int(((np.abs(a - mu) / sd) > 3).sum())

dups = 0
exp_sorted = exp.sort_values("Date")
for (cat, amt), g in exp_sorted.groupby(["Category", "Amount"]):
    if len(g) < 2:
        continue
    d = g["Date"].dropna().sort_values()
    dups += int((d.diff().dt.days.fillna(99) <= 7).sum())

print(f"\nANOMALY FALSE-POSITIVE PRESSURE:")
print(f"  >3σ outliers flagged: {flagged_sigma} ({100*flagged_sigma/len(exp):.2f}% of expenses)")
print(f"  duplicate-suspects (same cat+amount within 7d): {dups} ({100*dups/len(exp):.2f}%)")
print(f"  → at this rate a 200-expense/mo user gets ~{round(200*(flagged_sigma+dups)/len(exp))} alerts/mo")
