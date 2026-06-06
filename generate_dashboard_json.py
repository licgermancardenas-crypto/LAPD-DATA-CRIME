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
    "total_crimes":     total,
    "clearance_rate":   round(cleared / total * 100, 1),
    "violent_pct":      round(violent / total * 100, 1),
    "violent_crimes":   violent,
    "crimes_2024":      c2024,
    "yoy_2024_vs_2023": yoy,
    "by_year":          by_year,
}
(OUT / "summary.json").write_text(json.dumps(summary, indent=2))
print(f"  total={total:,}  clearance={summary['clearance_rate']}%  violent={summary['violent_pct']}%  yoy={yoy}%")


# ═══════════════════════════════════════════════════════════════════════════
# 2. monthly.json  (MonthlyTrend + UnemploymentChart)
# ═══════════════════════════════════════════════════════════════════════════
print("\n[2/6] monthly.json ...")

monthly_df = monthly_df.sort_values(["year","month"]).reset_index(drop=True)
monthly_df["rolling3"] = monthly_df["crimes"].rolling(3, min_periods=1).mean().round(0).astype(int)

monthly = []
for _, r in monthly_df.iterrows():
    monthly.append({
        "period":     str(r["period"]),          # "2020-01"
        "year":       int(r["year"]),
        "month":      int(r["month"]),
        "crimes":     int(r["crimes"]),
        "violent":    int(r["violent"]),
        "rolling3":   int(r["rolling3"]),
        "unemp_rate": float(round(r["unemp_rate"], 1)),
    })

(OUT / "monthly.json").write_text(json.dumps(monthly, indent=2))
print(f"  {len(monthly)} months")


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
    weather_out.append({
        "date":   str(r["date_str"]),
        "year":   int(r["year"]),
        "temp_f": round(float(r["_temp"]), 1) if pd.notna(r["_temp"]) else None,
        "rain":   bool(r["_rain"]),
        "crimes": int(r["crimes"]),
    })

(OUT / "weather_daily.json").write_text(json.dumps(weather_out, indent=2))
print(f"  {len(weather_out)} days")


# ── Summary ───────────────────────────────────────────────────────────────
print("\n" + "="*55)
print(f"Output: {OUT}")
for f in sorted(OUT.glob("*.json")):
    kb = f.stat().st_size / 1024
    print(f"  {f.name:<30} {kb:>7.1f} KB")
print("\nNext: push dashboard/public/data/ to git → Vercel auto-deploys.")
