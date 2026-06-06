"""
Generate dashboard/public/data/neighborhood_mortality.geojson

Business stability analysis per neighborhood using active business age distribution.
Closed businesses lack coordinates (~99.2%), so we analyze active business cohort ages
as a proxy for commercial ecosystem stability, then cross with crime data.

Key insight:
  - Young businesses (< 3 yrs) = high turnover / post-crisis startups
  - Anchor businesses (10+ yrs)  = stable commercial ecosystem
  - High crime + few anchors    = "Stressed" quadrant

Run from repo root:
    python scripts/generate_mortality_data.py
"""

import numpy as np
import pandas as pd
import geopandas as gpd
from pathlib import Path
from shapely.geometry import Point

ROOT    = Path(__file__).parent.parent
PARQUET = Path(r"C:\Users\corra\Desktop\POWER BI Proyectos\L.APD crimes\Listing_of_All_Businesses_20260606\businesses.parquet")
NB_FILE = ROOT / "dashboard/public/data/neighborhood_business_enriched.geojson"
OUT     = ROOT / "dashboard/public/data/neighborhood_mortality.geojson"

TODAY = pd.Timestamp("2026-06-06")

# ── 1. Load active businesses with valid coordinates ───────────────────────
print("Loading businesses...")
df = pd.read_parquet(PARQUET, columns=[
    "location", "location_start_date", "location_end_date",
    "primary_naics_description", "council_district"
])

# Active only (no end date)
active = df[df["location_end_date"].isna()].copy()
print(f"  {len(active):,} active businesses")

# Parse coordinates
import re
def parse_loc(s):
    if pd.isna(s): return None, None
    m = re.search(r'\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)', str(s))
    if not m: return None, None
    lat, lon = float(m.group(1)), float(m.group(2))
    return lat, lon

print("Parsing coordinates...")
coords = active["location"].apply(parse_loc)
lats = coords.apply(lambda x: x[0])
lons = coords.apply(lambda x: x[1])

mask = (
    lons.notna() &
    (lons < -100) &
    lats.between(33.5, 34.6)
)

# Compute age before subsetting to avoid large copy
age_days = (TODAY - active["location_start_date"]).dt.days
age_mask = age_days.between(0, 365 * 70)
final_mask = mask & age_mask

# Build lean DataFrame with only what we need
valid = pd.DataFrame({
    "lat":          lats[final_mask].values,
    "lon":          lons[final_mask].values,
    "age_yrs":      (age_days[final_mask].values / 365.25).round(2),
})
del active, coords, lats, lons, age_days, mask, age_mask, final_mask
import gc; gc.collect()
print(f"  {len(valid):,} active businesses with valid LA coordinates")

# Cohort labels
def cohort(yrs):
    if yrs < 3:   return "new"        # 0-3 years
    if yrs < 7:   return "growing"    # 3-7 years
    if yrs < 15:  return "established"# 7-15 years
    return "anchor"                   # 15+ years

valid["cohort"] = valid["age_yrs"].apply(cohort)

# ── 3. Spatial join to neighborhoods ──────────────────────────────────────
print("Loading neighborhoods and spatial join...")
nb = gpd.read_file(NB_FILE)

biz_gdf = gpd.GeoDataFrame(
    valid,
    geometry=[Point(lon, lat) for lat, lon in zip(valid["lat"], valid["lon"])],
    crs=4326
)

joined = gpd.sjoin(
    biz_gdf[["geometry", "age_yrs", "cohort"]],
    nb[["geometry", "name"]],
    how="left", predicate="within"
).dropna(subset=["name"])

print(f"  {len(joined):,} businesses matched")

# ── 4. Aggregate per neighborhood ─────────────────────────────────────────
print("Aggregating...")

base = joined.groupby("name").agg(
    biz_total       = ("age_yrs", "count"),
    median_age_yrs  = ("age_yrs", "median"),
    mean_age_yrs    = ("age_yrs", "mean"),
    pct_new         = ("cohort", lambda x: (x == "new").mean() * 100),
    pct_growing     = ("cohort", lambda x: (x == "growing").mean() * 100),
    pct_established = ("cohort", lambda x: (x == "established").mean() * 100),
    pct_anchor      = ("cohort", lambda x: (x == "anchor").mean() * 100),
).reset_index()

for col in ["median_age_yrs", "mean_age_yrs", "pct_new", "pct_growing",
            "pct_established", "pct_anchor"]:
    base[col] = base[col].round(1)

# ── 5. Compute stability & churn scores ───────────────────────────────────
# Stability: anchors + established carry more weight
base["stability_score"] = (
    (base["pct_anchor"]      * 1.0 +
     base["pct_established"] * 0.5) / 150
).clip(0, 1).round(4)

# Churn: inverse of stability — high newbie ratio
base["churn_score"] = (
    base["pct_new"] / 100
).clip(0, 1).round(4)

# ── 6. Merge with existing crime data ────────────────────────────────────
crime_cols = ["name", "crime_count", "crimes_per_1000", "crimes_per_biz",
              "vulnerability_score", "vulnerability_label",
              "median_income", "poverty_rate", "population",
              "biz_count", "norm_crime_abs", "norm_crime_rate",
              "norm_vulnerability", "norm_biz_count",
              "division", "div_clearance", "div_top_category",
              "crime_rank", "biz_rank", "biz_per_1000"]
result = nb.merge(base, on="name", how="left")

# ── 7. Quadrant classification ───────────────────────────────────────────
# Use median crime rate and median stability score as thresholds
med_crime   = result["crimes_per_1000"].median()
med_stability = result["stability_score"].median()

def quadrant(row):
    high_crime = (row["crimes_per_1000"] or 0) >= med_crime
    stable     = (row["stability_score"] or 0) >= med_stability
    if high_crime and not stable: return "Stressed"       # worst: high crime + young biz
    if high_crime and stable:     return "Resilient"      # high crime but old businesses survive
    if not high_crime and not stable: return "Emerging"   # low crime but high turnover
    return "Thriving"                                     # low crime + stable businesses

result["quadrant"] = result.apply(quadrant, axis=1)

# ── 8. Normalize for choropleth ────────────────────────────────────────────
cap_age = result["median_age_yrs"].quantile(0.98)
cap_stab = 1.0
result["norm_median_age"]  = (result["median_age_yrs"]  / cap_age).clip(0,1).round(4)
result["norm_stability"]   = result["stability_score"].clip(0,1)
result["norm_churn"]       = result["churn_score"].clip(0,1)
result["norm_anchor"]      = (result["pct_anchor"] / result["pct_anchor"].quantile(0.98)).clip(0,1).round(4)

# ── 9. Write GeoJSON ───────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
result.to_file(OUT, driver="GeoJSON")

size_kb = OUT.stat().st_size / 1024
print(f"\nDone -> {OUT.name}  ({size_kb:.0f} KB)")
print(f"  neighborhoods: {len(result)}")

# Print quadrant distribution
q = result["quadrant"].value_counts()
print(f"\nQuadrant distribution:")
for label, cnt in q.items():
    print(f"  {label:<12}: {cnt:3} neighborhoods")

print(f"\nMedian business age thresholds used:")
print(f"  Crime/1000 threshold: {med_crime:.1f}")
print(f"  Stability threshold:  {med_stability:.3f}")

print(f"\nTop 10 most STABLE neighborhoods:")
top_stable = result.nlargest(10, "stability_score")[["name","stability_score","pct_anchor","median_age_yrs","crimes_per_1000","quadrant"]]
for _, r in top_stable.iterrows():
    print(f"  {r['name']:<28} stability={r['stability_score']:.2f}  anchor={r['pct_anchor']:.0f}%  age={r['median_age_yrs']:.1f}yr  crime/1k={r['crimes_per_1000']:.0f}  [{r['quadrant']}]")

print(f"\nTop 10 STRESSED neighborhoods (high crime + low stability):")
stressed = result[result["quadrant"]=="Stressed"].nlargest(10, "crimes_per_1000")[["name","crimes_per_1000","stability_score","pct_new","median_age_yrs","median_income"]]
for _, r in stressed.iterrows():
    print(f"  {r['name']:<28} crime/1k={r['crimes_per_1000']:.0f}  stability={r['stability_score']:.2f}  new_biz={r['pct_new']:.0f}%  age={r['median_age_yrs']:.1f}yr  income=${r['median_income']:,.0f}")
