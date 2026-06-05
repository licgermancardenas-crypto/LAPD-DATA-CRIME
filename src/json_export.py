"""
Phase 4B -- JSON Data Export for Next.js Dashboard
Converts aggregate CSV tables to optimised JSON files for the web app.

Output: dashboard/public/data/
  summary.json         Global KPIs (total crimes, clearance rate, etc.)
  monthly.json         60 months of KPIs + weather + unemployment
  hourly_dow.json      168 cells: hour x day-of-week crime counts (normalised)
  division.json        21 LAPD divisions with crime counts + clearance rate
  categories.json      18 crime categories with counts + clearance
  weather_daily.json   1,827 daily rows (crimes + temp + rain)

Run: python src/json_export.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT    = Path(__file__).parent.parent
PBI     = ROOT / "data" / "powerbi"
PROC    = ROOT / "data" / "processed"
OUT_DIR = ROOT / "dashboard" / "public" / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
               "Jul","Aug","Sep","Oct","Nov","Dec"]
DAY_NAMES   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]


def _load(name: str) -> pd.DataFrame:
    path = PBI / f"{name}.csv"
    if not path.exists():
        raise FileNotFoundError(f"Run src/powerbi_export.py first: {path}")
    return pd.read_csv(path)


def _save(name: str, obj) -> None:
    path = OUT_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), allow_nan=False)
    size = path.stat().st_size / 1024
    print(f"  {name}.json  {size:,.0f} KB")


def _safe_float(v, decimals=2):
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return round(float(v), decimals)


# ══════════════════════════════════════════════════════════════════════════════

def build_summary(monthly: pd.DataFrame) -> dict:
    total = int(monthly["crimes"].sum())
    cleared = int(monthly["cleared"].sum())
    violent = int(monthly["violent"].sum())

    # YoY 2024 vs 2023
    y24 = int(monthly[monthly["year"] == 2024]["crimes"].sum())
    y23 = int(monthly[monthly["year"] == 2023]["crimes"].sum())
    y22 = int(monthly[monthly["year"] == 2022]["crimes"].sum())
    yoy_pct = round((y24 - y23) / y23 * 100, 1) if y23 else None

    # Clearance
    clearance = round(cleared / total * 100, 1) if total else None

    # By year
    by_year = (monthly.groupby("year")
               .agg(crimes=("crimes","sum"), cleared=("cleared","sum"),
                    violent=("violent","sum"))
               .reset_index())
    by_year["clearance_rate"] = (by_year["cleared"] / by_year["crimes"] * 100).round(1)
    by_year["violent_pct"]    = (by_year["violent"]  / by_year["crimes"] * 100).round(1)

    return {
        "total_crimes"    : total,
        "cleared_cases"   : cleared,
        "violent_crimes"  : violent,
        "clearance_rate"  : clearance,
        "violent_pct"     : round(violent / total * 100, 1),
        "property_pct"    : round(monthly["property_c"].sum() / total * 100, 1),
        "yoy_2024_vs_2023": yoy_pct,
        "crimes_2024"     : y24,
        "crimes_2023"     : y23,
        "crimes_2022"     : y22,
        "by_year"         : by_year[["year","crimes","clearance_rate","violent_pct"]].to_dict("records"),
    }


def build_monthly(monthly: pd.DataFrame) -> list:
    rows = []
    for _, r in monthly.sort_values(["year","month"]).iterrows():
        rows.append({
            "period"         : str(r["period"]),
            "year"           : int(r["year"]),
            "month"          : int(r["month"]),
            "month_name"     : MONTH_NAMES[int(r["month"]) - 1],
            "crimes"         : int(r["crimes"]),
            "violent"        : int(r["violent"]),
            "cleared"        : int(r["cleared"]),
            "clearance_rate" : _safe_float(r.get("clearance_rate_pct")),
            "violent_pct"    : _safe_float(r.get("violent_pct")),
            "unemp_rate"     : _safe_float(r.get("unemp_rate")),
            "temp_avg"       : _safe_float(r.get("temp_avg")),
            "precip_sum"     : _safe_float(r.get("precip_sum"), 3),
        })
    # Add 3-month rolling average
    crimes = [r["crimes"] for r in rows]
    for i, r in enumerate(rows):
        window = crimes[max(0, i-2):i+1]
        r["rolling3"] = round(sum(window) / len(window))
    return rows


def build_hourly_dow(hourly_dow: pd.DataFrame) -> list:
    # Normalise to crimes per 1000 for consistent colour scale
    max_val = hourly_dow["crimes"].max()
    rows = []
    for _, r in hourly_dow.iterrows():
        rows.append({
            "dow"      : int(r["day_of_week"]),
            "day"      : DAY_NAMES[int(r["day_of_week"])],
            "hour"     : int(r["hour"]),
            "crimes"   : int(r["crimes"]),
            "intensity": round(r["crimes"] / max_val, 4),
        })
    return rows


def build_division(div_cat: pd.DataFrame) -> list:
    g = (div_cat.groupby("AREA NAME")
         .agg(crimes=("crimes","sum"), cleared=("cleared","sum"),
              violent=("violent","sum"))
         .reset_index()
         .sort_values("crimes", ascending=False))
    g["clearance_rate"] = (g["cleared"] / g["crimes"] * 100).round(1)
    g["violent_pct"]    = (g["violent"]  / g["crimes"] * 100).round(1)
    rows = []
    for _, r in g.iterrows():
        rows.append({
            "name"          : str(r["AREA NAME"]),
            "crimes"        : int(r["crimes"]),
            "clearance_rate": _safe_float(r["clearance_rate"]),
            "violent_pct"   : _safe_float(r["violent_pct"]),
        })
    return rows


def build_categories(div_cat: pd.DataFrame) -> list:
    g = (div_cat.groupby("crime_category")
         .agg(crimes=("crimes","sum"), cleared=("cleared","sum"),
              violent=("violent","sum"))
         .reset_index()
         .sort_values("crimes", ascending=False))
    g["clearance_rate"] = (g["cleared"] / g["crimes"] * 100).round(1)
    total = g["crimes"].sum()
    rows = []
    for _, r in g.iterrows():
        rows.append({
            "category"      : str(r["crime_category"]),
            "crimes"        : int(r["crimes"]),
            "share_pct"     : round(r["crimes"] / total * 100, 1),
            "clearance_rate": _safe_float(r["clearance_rate"]),
            "is_violent"    : int(r["violent"]) > 0,
        })
    return rows


def build_weather_daily(daily: pd.DataFrame) -> list:
    cols_needed = ["date_str", "crimes", "violent", "temp_avg_f",
                   "precip_in", "is_hot_day", "is_rainy", "year"]
    cols = [c for c in cols_needed if c in daily.columns]
    d = daily[cols].copy()
    for c in ["is_hot_day", "is_rainy"]:
        if c in d.columns:
            d[c] = d[c].fillna(0).astype(int)
    rows = []
    for _, r in d.iterrows():
        rows.append({
            "date"      : str(r["date_str"]),
            "crimes"    : int(r["crimes"]),
            "violent"   : int(r.get("violent", 0)),
            "temp"      : _safe_float(r.get("temp_avg_f")),
            "precip"    : _safe_float(r.get("precip_in"), 3),
            "isHot"     : int(r.get("is_hot_day", 0)),
            "isRainy"   : int(r.get("is_rainy", 0)),
            "year"      : int(r.get("year", 0)),
        })
    return rows


# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 55)
    print("  Phase 4B - JSON Export for Next.js Dashboard")
    print("=" * 55 + "\n")

    monthly    = _load("agg_monthly")
    hourly_dow = _load("agg_hourly_dow")
    div_cat    = _load("agg_division_cat")
    daily      = _load("agg_daily")

    print("Building JSON payloads...")
    summary   = build_summary(monthly)
    monthly_j = build_monthly(monthly)
    hdow_j    = build_hourly_dow(hourly_dow)
    div_j     = build_division(div_cat)
    cat_j     = build_categories(div_cat)
    weather_j = build_weather_daily(daily)

    print("\nSaving JSON files...")
    _save("summary",       summary)
    _save("monthly",       monthly_j)
    _save("hourly_dow",    hdow_j)
    _save("division",      div_j)
    _save("categories",    cat_j)
    _save("weather_daily", weather_j)

    print(f"\nAll JSON files -> {OUT_DIR}")
    print("=" * 55)


if __name__ == "__main__":
    main()
