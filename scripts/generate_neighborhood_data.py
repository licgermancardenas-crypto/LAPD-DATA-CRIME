"""
Generate dashboard/public/data/neighborhood_crimes.geojson

Area-weighted aggregation of census tract data -> LA Times neighborhoods.
Also assigns each neighborhood its primary LAPD division.

Sources:
  - dashboard/public/data/vulnerability_tracts.geojson  (crime, pop, poverty, income)
  - LA_Times_Neighborhood_Boundaries.geojson            (114 neighborhoods)
  - LAPD_Division_-8371726096393184647.geojson          (21 division polygons)
  - dashboard/public/data/lapd_divisions_crimes.geojson (division crime stats)

Run from repo root:
    pip install geopandas pandas shapely
    python scripts/generate_neighborhood_data.py

Output: dashboard/public/data/neighborhood_crimes.geojson
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd

ROOT = Path(__file__).parent.parent
OUT  = ROOT / "dashboard/public/data/neighborhood_crimes.geojson"

# ── 1. Load sources ────────────────────────────────────────────────────────
print("Loading layers...")
tracts = gpd.read_file(ROOT / "dashboard/public/data/vulnerability_tracts.geojson")
nb     = gpd.read_file(ROOT / "LA_Times_Neighborhood_Boundaries.geojson")
divs   = gpd.read_file(ROOT / "LAPD_Division_-8371726096393184647.geojson")
stns   = gpd.read_file(ROOT / "LAPD_Police_Stations_1065107508733256029.geojson")

for gdf, name in [(tracts,'tracts'),(nb,'neighborhoods'),(divs,'divisions'),(stns,'stations')]:
    if gdf.crs is None or gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(4326)
    print(f"  {name}: {len(gdf)} features")

# Project to a planar CRS for area calculations (California Albers)
CRS_M = "EPSG:3310"
tracts_m = tracts.to_crs(CRS_M)
nb_m     = nb.to_crs(CRS_M)

# ── 2. Area-weighted aggregation: tracts -> neighborhoods ──────────────────
print("Computing area-weighted intersection (tracts -> neighborhoods)...")

tracts_m = tracts_m.copy()
tracts_m["tract_area"] = tracts_m.geometry.area

# Overlay: get tract-neighborhood intersection polygons
inter = gpd.overlay(
    tracts_m[["geometry","tract_area","crime_count","population",
               "poverty_rate","median_income","pct_hispanic","pct_black",
               "pct_asian","pct_white","pct_no_hs","pct_limited_eng",
               "pct_no_internet","vulnerability_score"]],
    nb_m[["geometry","name"]],
    how="intersection",
    keep_geom_type=True
)

# Fraction of each tract covered by each neighborhood
inter["inter_area"] = inter.geometry.area
inter["frac"] = (inter["inter_area"] / inter["tract_area"]).clip(0, 1)

# Allocate numeric fields proportionally
for col in ["crime_count", "population"]:
    inter[col + "_alloc"] = pd.to_numeric(inter[col], errors="coerce").fillna(0) * inter["frac"]

# Population-weighted averages for rates
inter["pop_alloc"] = pd.to_numeric(inter["population"], errors="coerce").fillna(0) * inter["frac"]
for col in ["poverty_rate","median_income","pct_hispanic","pct_black",
            "pct_asian","pct_white","pct_no_hs","pct_limited_eng",
            "pct_no_internet","vulnerability_score"]:
    inter[col + "_pw"] = pd.to_numeric(inter[col], errors="coerce").fillna(0) * inter["pop_alloc"]

# Aggregate to neighborhoods
agg = inter.groupby("name").agg(
    crime_count    = ("crime_count_alloc", "sum"),
    population     = ("pop_alloc",         "sum"),
    **{col + "_pw_sum": (col + "_pw", "sum") for col in
       ["poverty_rate","median_income","pct_hispanic","pct_black",
        "pct_asian","pct_white","pct_no_hs","pct_limited_eng",
        "pct_no_internet","vulnerability_score"]},
    pop_total      = ("pop_alloc", "sum"),
).reset_index()

# Compute population-weighted rates
for col in ["poverty_rate","median_income","pct_hispanic","pct_black",
            "pct_asian","pct_white","pct_no_hs","pct_limited_eng",
            "pct_no_internet","vulnerability_score"]:
    agg[col] = np.where(
        agg["pop_total"] > 0,
        agg[col + "_pw_sum"] / agg["pop_total"],
        0
    )
    agg.drop(columns=[col + "_pw_sum"], inplace=True)

agg.drop(columns=["pop_total"], inplace=True)
agg["crime_count"]  = agg["crime_count"].round(0).astype(int)
agg["population"]   = agg["population"].round(0).astype(int)
print(f"  aggregated to {len(agg)} neighborhoods")

# ── 3. Assign primary LAPD division to each neighborhood ──────────────────
print("Assigning LAPD division to each neighborhood...")
# Use neighborhood centroid to find containing division
nb_centroids = nb.copy()
nb_centroids["geometry"] = nb.geometry.centroid
nb_with_div = gpd.sjoin(
    nb_centroids[["name","geometry"]],
    divs[["geometry","APREC","PREC"]].rename(columns={"APREC":"division","PREC":"prec"}),
    how="left", predicate="within"
).drop_duplicates("name")[["name","division","prec"]]

agg = agg.merge(nb_with_div, on="name", how="left")

# ── 4. Load division crime stats to enrich division assignment ─────────────
div_stats = json.load(open(ROOT / "dashboard/public/data/lapd_divisions_crimes.geojson"))
div_map = {
    f["properties"]["prec"]: {
        "div_total_crimes": f["properties"]["total_crimes"],
        "div_clearance":    f["properties"]["clearance"],
        "div_top_category": f["properties"]["top_category"],
    }
    for f in div_stats["features"]
}
agg["div_total_crimes"] = agg["prec"].map(lambda p: div_map.get(p, {}).get("div_total_crimes", 0))
agg["div_clearance"]    = agg["prec"].map(lambda p: div_map.get(p, {}).get("div_clearance", None))
agg["div_top_category"] = agg["prec"].map(lambda p: div_map.get(p, {}).get("div_top_category", ""))

# ── 5. Derived metrics ─────────────────────────────────────────────────────
agg["crimes_per_1000"] = np.where(
    agg["population"] > 0,
    (agg["crime_count"] / (agg["population"] / 1000)).round(1),
    0
)

# Crime rank among all neighborhoods (1 = most crimes)
agg = agg.sort_values("crime_count", ascending=False).reset_index(drop=True)
agg["crime_rank"] = agg.index + 1

# Normalize crime count and crimes_per_1000 for choropleth
cap_abs   = agg["crime_count"].quantile(0.98)
cap_rate  = agg.loc[agg["crimes_per_1000"] > 0, "crimes_per_1000"].quantile(0.98)
agg["norm_crime_abs"]  = (agg["crime_count"]    / cap_abs).clip(0, 1).round(4)
agg["norm_crime_rate"] = (agg["crimes_per_1000"] / cap_rate).clip(0, 1).round(4)
agg["norm_vulnerability"] = (agg["vulnerability_score"] / 1.0).clip(0, 1).round(4)
cap_poverty = agg.loc[agg["poverty_rate"] > 0, "poverty_rate"].quantile(0.98)
agg["norm_poverty"] = (agg["poverty_rate"] / cap_poverty).clip(0, 1).round(4)

# Vulnerability label
def vul_label(v):
    if v < 0.25: return "Low"
    if v < 0.50: return "Moderate"
    if v < 0.75: return "High"
    return "Very High"

agg["vulnerability_label"] = agg["vulnerability_score"].apply(vul_label)

# Round display fields
for col in ["poverty_rate","pct_hispanic","pct_black","pct_asian","pct_white",
            "pct_no_hs","pct_limited_eng","pct_no_internet","vulnerability_score"]:
    agg[col] = agg[col].round(1)
agg["median_income"]  = agg["median_income"].round(0).astype(int)
agg["div_clearance"]  = agg["div_clearance"].round(1).fillna(0)

# ── 6. Merge geometry back ────────────────────────────────────────────────
result = nb.merge(agg, on="name", how="left")
result = gpd.GeoDataFrame(result, geometry="geometry", crs=4326)

# ── 7. Write GeoJSON ───────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
result.to_file(OUT, driver="GeoJSON")

print(f"\nDone -> {OUT}")
print(f"  neighborhoods: {len(result)}")
print(f"  total crimes mapped: {agg['crime_count'].sum():,.0f}")
print(f"  total population:    {agg['population'].sum():,.0f}")
print(f"\nTop 10 neighborhoods by crime count:")
for _, row in agg.head(10).iterrows():
    print(f"  {row['crime_rank']:2}. {row['name']:<28} {row['crime_count']:>7,} crimes  {row['crimes_per_1000']:>6.1f}/1k  div:{row['division']}")
