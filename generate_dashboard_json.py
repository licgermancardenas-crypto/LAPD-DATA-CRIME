#!/usr/bin/env python3
"""
generate_dashboard_json.py
Generates the 6 JSON files for the LAPD Crime Dashboard
using the pre-aggregated CSVs already in data/powerbi/ and data/external/.

Run from repo root:
    python generate_dashboard_json.py

No extra args needed — paths are relative to the repo.
"""

import json
import sys
import calendar
from pathlib import Path

try:
    import pandas as pd
    import numpy as np
except ImportError:
    sys.exit("pip install pandas numpy")

ROOT = Path(__file__).parent
DATA = ROOT / "data" / "powerbi"
EXT  = ROOT / "data" / "external"
OUT  = ROOT / "dashboard" / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

# ── Load pre-aggregated CSVs ──────────────────────────────────────────────
print("Loading CSVs...")
monthly_df   = pd.read_csv(DATA / "agg_monthly.csv")
hourly_df    = pd.read_csv(DATA / "agg_hourly_dow.csv")
div_cat_df   = pd.read_csv(DATA / "agg_division_cat.csv")
dim_cat_df   = pd.read_csv(DATA / "dim_crime_cat.csv")
daily_df     = pd.read_csv(DATA / "agg_daily.csv")
weather_df   = pd.read_csv(EXT  / "weather_la_2020_2024.csv")

print(f"  monthly: {len(monthly_df)} rows")
print(f"  hourly:  {len(hourly_df)} rows")
print(f"  div_cat: {len(div_cat_df)} rows")
print(f"  daily:   {len(daily_df)} rows")


# ═══════════════════════════════════════════════════════════════════════════
# 1. summary.json
# ═══════════════════════════════════════════════════════════════════════════
print("\n[1/6] summary.json ...")

by_year = []
for yr, g in monthly_df.groupby("year"):
    total_yr  = int(g["crimes"].sum())
    cleared_yr = int(g["cleared"].sum())
    violent_yr = int(g["violent"].sum())
    by_year.append({
        "year":           int(yr),
        "crimes":         total_yr,
        "clearance_rate": round(cleared_yr / total_yr * 100, 1) if total_yr else 0,
        "violent_pct":    round(violent_yr / total_yr * 100, 1) if total_yr else 0,
    })
by_year.sort(key=lambda x: x["year"])

total   = int(monthly_df["crimes"].sum())
cleared = int(monthly_df["cleared"].sum())
violent = int(monthly_df["violent"].sum())

c2023 = next((y["crimes"] for y in by_year if y["year"] == 2023), 1)
c2024 = next((y["crimes"] for y in by_year if y["year"] == 2024), 0)
yoy   = round((c2024 - c2023) / c2023 * 100, 1) if c2023 else 0

summary = {
    "total_crimes":       total,
    "clearance_rate":     round(cleared / total * 100, 1),
    "violent_pct":        round(violent / total * 100, 1),
    "violent_crimes":     violent,
    "crimes_2024":        c2024,
    "yoy_2024_vs_2023":   yoy,
    "avg_reporting_lag":  None,   # filled in after monthly is computed
    "by_year":            by_year,
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2))
print(f"  total={total:,}  clearance={summary['clearance_rate']}%  violent={summary['violent_pct']}%  yoy={yoy}%")


# ═══════════════════════════════════════════════════════════════════════════
# 2. monthly.json  (MonthlyTrend + UnemploymentChart + ReportingLagChart)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[2/6] monthly.json ...")

# ── Reporting lag from fact_crimes.csv (cap at 365 to remove data-entry errors) ──
print("  Loading fact_crimes for reporting lag (161 MB)...")
lag_df = pd.read_csv(DATA / "fact_crimes.csv", usecols=["date_key", "days_to_report"])
lag_df["date_key"] = lag_df["date_key"].astype(str)
lag_df["year"]  = lag_df["date_key"].str[:4].astype(int)
lag_df["month"] = lag_df["date_key"].str[4:6].astype(int)
lag_df = lag_df[lag_df["days_to_report"].between(0, 365)]   # drop obvious data errors
lag_monthly = (
    lag_df.groupby(["year", "month"])["days_to_report"]
    .mean().round(1).reset_index()
    .rename(columns={"days_to_report": "avg_lag"})
)

# ── Merge lag into monthly aggregation ────────────────────────────────────
monthly_df = monthly_df.sort_values(["year", "month"]).reset_index(drop=True)
monthly_df = monthly_df.merge(lag_monthly, on=["year", "month"], how="left")

# ── Daily averages (normalize for unequal month lengths) ──────────────────
monthly_df["days_in_month"] = monthly_df.apply(
    lambda r: calendar.monthrange(int(r["year"]), int(r["month"]))[1], axis=1
)
monthly_df["daily_avg"]     = (monthly_df["crimes"]  / monthly_df["days_in_month"]).round(1)
monthly_df["daily_violent"] = (monthly_df["violent"] / monthly_df["days_in_month"]).round(1)

# ── Rolling 3-month averages ───────────────────────────────────────────────
monthly_df["rolling3"]       = monthly_df["crimes"].rolling(3, min_periods=1).mean().round(0).astype(int)
monthly_df["rolling3_daily"] = monthly_df["daily_avg"].rolling(3, min_periods=1).mean().round(1)
monthly_df["rolling3_lag"]   = monthly_df["avg_lag"].rolling(3, min_periods=1).mean().round(1)

monthly = []
for _, r in monthly_df.iterrows():
    monthly.append({
        "period":        str(r["period"]),
        "year":          int(r["year"]),
        "month":         int(r["month"]),
        "crimes":        int(r["crimes"]),
        "violent":       int(r["violent"]),
        "daily_avg":     float(r["daily_avg"]),
        "daily_violent": float(r["daily_violent"]),
        "rolling3":      int(r["rolling3"]),
        "rolling3_daily":float(r["rolling3_daily"]),
        "avg_lag":       float(r["avg_lag"]) if pd.notna(r["avg_lag"]) else None,
        "rolling3_lag":  float(r["rolling3_lag"]) if pd.notna(r["rolling3_lag"]) else None,
        "unemp_rate":    float(round(r["unemp_rate"], 1)),
    })

(OUT / "monthly.json").write_text(json.dumps(monthly, indent=2))
print(f"  {len(monthly)} months")
lag_vals = [m["avg_lag"] for m in monthly if m["avg_lag"] is not None]
overall_lag = round(sum(lag_vals) / len(lag_vals), 1)
print(f"  Lag range: {min(lag_vals):.1f}-{max(lag_vals):.1f} days  overall_avg={overall_lag} days")

# Back-fill avg_reporting_lag into summary and re-write
summary["avg_reporting_lag"] = overall_lag
(OUT / "summary.json").write_text(json.dumps(summary, indent=2))


# ═══════════════════════════════════════════════════════════════════════════
# 3. hourly_dow.json  (HourHeatmap — 7×24 grid)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[3/6] hourly_dow.json ...")

max_c = hourly_df["crimes"].max()

hourly = []
for _, r in hourly_df.iterrows():
    hourly.append({
        "dow":       int(r["day_of_week"]),
        "hour":      int(r["hour"]),
        "crimes":    int(r["crimes"]),
        "intensity": round(float(r["crimes"] / max_c), 4),
    })

(OUT / "hourly_dow.json").write_text(json.dumps(hourly, indent=2))
print(f"  {len(hourly)} cells (expected 168)")


# ═══════════════════════════════════════════════════════════════════════════
# 4. division.json  (DivisionBar — name, crimes, clearance_rate, violent_pct)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[4/6] division.json ...")

div_agg = (
    div_cat_df
    .groupby("AREA NAME")
    .agg(crimes=("crimes","sum"), cleared=("cleared","sum"), violent=("violent","sum"))
    .reset_index()
)

division = []
for _, r in div_agg.iterrows():
    c = int(r["crimes"])
    division.append({
        "name":           str(r["AREA NAME"]).strip().title(),
        "crimes":         c,
        "clearance_rate": round(float(r["cleared"]) / c * 100, 1) if c else 0,
        "violent_pct":    round(float(r["violent"]) / c * 100, 1) if c else 0,
    })

division.sort(key=lambda x: x["crimes"], reverse=True)
(OUT / "division.json").write_text(json.dumps(division, indent=2))
print(f"  {len(division)} divisions")
for d in division[:5]:
    print(f"    {d['name']:<22} {d['crimes']:>7,}  clr={d['clearance_rate']}%  vio={d['violent_pct']}%")


# ═══════════════════════════════════════════════════════════════════════════
# 5. categories.json  (CategoryChart — 18 UCR categories)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[5/6] categories.json ...")

# Build is_violent lookup from dim_crime_cat
violent_lookup = dict(zip(dim_cat_df["crime_category"], dim_cat_df["is_violent"].astype(bool)))

cat_agg = (
    div_cat_df
    .groupby("crime_category")
    .agg(crimes=("crimes","sum"), cleared=("cleared","sum"), violent=("violent","sum"))
    .reset_index()
)

total_c = int(cat_agg["crimes"].sum())
categories = []
for _, r in cat_agg.iterrows():
    c   = int(r["crimes"])
    cat = str(r["crime_category"])
    categories.append({
        "category":       cat,
        "crimes":         c,
        "share_pct":      round(c / total_c * 100, 1),
        "clearance_rate": round(float(r["cleared"]) / c * 100, 1) if c else 0,
        "is_violent":     bool(violent_lookup.get(cat, False)),
    })

categories.sort(key=lambda x: x["crimes"], reverse=True)
(OUT / "categories.json").write_text(json.dumps(categories, indent=2))
print(f"  {len(categories)} categories")
for cat in categories[:5]:
    print(f"    {cat['category']:<30} {cat['crimes']:>7,}  {cat['share_pct']}%  vio={cat['is_violent']}")


# ═══════════════════════════════════════════════════════════════════════════
# 6. weather_daily.json  (WeatherChart — scatter: temp_f vs daily crimes)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[6/6] weather_daily.json ...")

# Merge daily crime counts with real weather data
daily_df["date"] = pd.to_datetime(daily_df["date_str"])
weather_df["date"] = pd.to_datetime(weather_df["date"])

merged = daily_df.merge(
    weather_df[["date","temp_avg_f","is_rainy","is_hot_day"]],
    on="date", how="left", suffixes=("","_wx")
)

# Use weather columns from weather_df if available, otherwise fall back to daily_df
merged["_temp"] = merged["temp_avg_f_wx"].fillna(merged["temp_avg_f"])
merged["_rain"] = merged["is_rainy_wx"].fillna(merged["is_rainy"])
# Normalize bool strings
merged["_rain"] = merged["_rain"].apply(
    lambda x: x if isinstance(x, bool) else str(x).strip().lower() == "true"
)

weather_out = []
for _, r in merged.iterrows():
    temp = round(float(r["_temp"]), 1) if pd.notna(r["_temp"]) else None
    weather_out.append({
        "date":    str(r["date_str"]),
        "year":    int(r["year"]),
        "temp":    temp,                          # WeatherChart XAxis dataKey="temp"
        "crimes":  int(r["crimes"]),
        "isHot":   bool(temp is not None and temp > 90),   # Cell opacity/radius
        "isRainy": bool(r["_rain"]),              # Tooltip indicator
    })

(OUT / "weather_daily.json").write_text(json.dumps(weather_out, indent=2))
print(f"  {len(weather_out)} days")


# ===========================================================================
# 7. victims.json  (VictimChart — 4 aggregations)
# ===========================================================================
print("\n[7/7] victims.json ...")

victim_df = pd.read_csv(DATA / "agg_victim.csv")

total_v = int(victim_df["crimes"].sum())

# ── by_sex ─────────────────────────────────────────────────────────────────
by_sex = []
for sex, g in victim_df.groupby("vict_sex"):
    c = int(g["crimes"].sum())
    v = int(g["violent"].sum())
    by_sex.append({
        "sex":        str(sex),
        "crimes":     c,
        "violent":    v,
        "share_pct":  round(c / total_v * 100, 1),
        "violent_pct":round(v / c * 100, 1) if c else 0,
    })
by_sex.sort(key=lambda x: x["crimes"], reverse=True)

# ── by_age ─────────────────────────────────────────────────────────────────
AGE_ORDER = ["Juvenile (<18)", "Young Adult (18-24)", "Adult (25-34)",
             "Adult (35-49)", "Middle-Aged (50-64)", "Senior (65+)"]
by_age = []
for age, g in victim_df.groupby("age_group"):
    c = int(g["crimes"].sum())
    v = int(g["violent"].sum())
    by_age.append({
        "age":         str(age),
        "crimes":      c,
        "violent":     v,
        "share_pct":   round(c / total_v * 100, 1),
        "violent_pct": round(v / c * 100, 1) if c else 0,
    })
by_age.sort(key=lambda x: AGE_ORDER.index(x["age"]) if x["age"] in AGE_ORDER else 99)

# ── by_descent ─────────────────────────────────────────────────────────────
by_descent = []
for desc, g in victim_df.groupby("descent_group"):
    if str(desc) == "Unknown":
        continue
    c = int(g["crimes"].sum())
    v = int(g["violent"].sum())
    by_descent.append({
        "descent":     str(desc),
        "crimes":      c,
        "violent":     v,
        "share_pct":   round(c / total_v * 100, 1),
        "violent_pct": round(v / c * 100, 1) if c else 0,
    })
by_descent.sort(key=lambda x: x["crimes"], reverse=True)

# ── by_cat_sex — top violent categories broken down by sex ─────────────────
VIOLENT_CATS = [
    "Violent - Assault & Battery", "Violent - Aggravated Assault",
    "Violent - Robbery", "Violent - Sexual Assault", "Violent - Homicide",
    "Domestic Violence", "Sex Offense", "Crimes Against Children",
]
# Normalize category names (the CSV has '?' instead of dash due to encoding)
victim_df["cat_clean"] = victim_df["crime_category"].str.replace(r"[^\w\s&/,()]+", "-", regex=True).str.strip()

cat_sex_pivot = (
    victim_df[victim_df["vict_sex"].isin(["Male", "Female"])]
    .groupby(["cat_clean", "vict_sex"])["crimes"]
    .sum()
    .unstack(fill_value=0)
    .reset_index()
)
cat_sex_pivot.columns.name = None
cat_sex_pivot = cat_sex_pivot.rename(columns={"cat_clean": "category"})

# Keep all categories, sort by total (Male+Female)
if "Male" not in cat_sex_pivot.columns:   cat_sex_pivot["Male"]   = 0
if "Female" not in cat_sex_pivot.columns: cat_sex_pivot["Female"] = 0
cat_sex_pivot["total"] = cat_sex_pivot["Male"] + cat_sex_pivot["Female"]
cat_sex_pivot = cat_sex_pivot.sort_values("total", ascending=False)

by_cat_sex = []
for _, r in cat_sex_pivot.iterrows():
    male   = int(r["Male"])
    female = int(r["Female"])
    total  = male + female
    by_cat_sex.append({
        "category":   str(r["category"]),
        "Male":       male,
        "Female":     female,
        "total":      total,
        "female_pct": round(female / total * 100, 1) if total else 0,
    })

victims_out = {
    "by_sex":     by_sex,
    "by_age":     by_age,
    "by_descent": by_descent,
    "by_cat_sex": by_cat_sex,
}

(OUT / "victims.json").write_text(json.dumps(victims_out, indent=2))
print(f"  by_sex={len(by_sex)}  by_age={len(by_age)}  by_descent={len(by_descent)}  by_cat_sex={len(by_cat_sex)}")
for d in by_descent:
    print(f"    {d['descent']:<18} {d['crimes']:>7,}  vio={d['violent_pct']}%")


# ── Summary ───────────────────────────────────────────────────────────────
print("\n" + "="*55)
print(f"Output: {OUT}")
for f in sorted(OUT.glob("*.json")):
    kb = f.stat().st_size / 1024
    print(f"  {f.name:<30} {kb:>7.1f} KB")
print("\nNext: push dashboard/public/data/ to git → Vercel auto-deploys.")
