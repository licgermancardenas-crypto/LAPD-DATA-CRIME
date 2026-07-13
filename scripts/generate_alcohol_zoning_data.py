"""
Generate dashboard/public/data/alcohol_density.geojson and
dashboard/public/data/zoning_by_division.json from the ABC license and
zoning sources (see fetch_abc_licenses.py / fetch_zoning.py).

alcohol_density.geojson: active ABC licenses per Census tract (off-sale /
on-sale / other split), normalized per 1,000 residents using
census_tracts_la.geojson's pop_total (now populated -- see the 2026-07-12
census join fix in src/external_data.py).

zoning_by_division.json: % of land area by zoning category (Residential,
Commercial, Manufacturing, etc.) per LAPD division, via spatial overlay --
a static land-use profile, not a crime-derived stat.

Run from repo root:
    python scripts/generate_alcohol_zoning_data.py
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).parent.parent
ABC = ROOT / "data" / "external" / "abc_licenses_by_tract.csv"
ZONING = ROOT / "data" / "external" / "zoning_la.geojson"
TRACTS = ROOT / "data" / "external" / "census_tracts_la.geojson"
DIVISIONS = ROOT / "data" / "external" / "lapd_divisions.geojson"
OUT_ALCOHOL = ROOT / "dashboard" / "public" / "data" / "alcohol_density.geojson"
OUT_ZONING = ROOT / "dashboard" / "public" / "data" / "zoning_by_division.json"

# ── 1. Alcohol outlet density per tract ────────────────────────────────────
print("Building alcohol_density.geojson...")
abc = pd.read_csv(ABC, dtype={"GEOID": str})
tracts = gpd.read_file(TRACTS)

merged = tracts.merge(abc, on="GEOID", how="left")
for col in ["off_sale", "on_sale", "other", "total_licenses"]:
    merged[col] = merged[col].fillna(0).astype(int)

merged["licenses_per_1000"] = (
    merged["total_licenses"] / merged["pop_total"].replace(0, np.nan) * 1000
).round(2)

OUT_ALCOHOL.parent.mkdir(parents=True, exist_ok=True)
merged.to_file(OUT_ALCOHOL, driver="GeoJSON")
print(f"  {len(merged)} tracts -> {OUT_ALCOHOL}")
print(f"  Total active licenses matched: {merged['total_licenses'].sum():,}")

# ── 2. Zoning mix per LAPD division ────────────────────────────────────────
print("Building zoning_by_division.json...")
zoning = gpd.read_file(ZONING)
divs = gpd.read_file(DIVISIONS)
if zoning.crs != divs.crs:
    zoning = zoning.to_crs(divs.crs)

# Parcel-level boundaries carry ~10M vertices total -- far more detail than
# an areal-composition-per-division aggregate needs. Simplify first
# (~11m tolerance in degrees) so the reprojection below doesn't blow memory.
zoning["geometry"] = zoning.geometry.simplify(0.0001, preserve_topology=True)

# Equal-area projection for accurate area calculations (CA Albers)
zoning_proj = zoning.to_crs("EPSG:3310")
divs_proj = divs.to_crs("EPSG:3310")

overlay = gpd.overlay(zoning_proj[["CATEGORY", "geometry"]], divs_proj[["area name", "geometry"]], how="intersection")
overlay["area_m2"] = overlay.geometry.area

by_div_cat = overlay.groupby(["area name", "CATEGORY"])["area_m2"].sum().reset_index()
div_totals = by_div_cat.groupby("area name")["area_m2"].sum().rename("total_m2")
by_div_cat = by_div_cat.merge(div_totals, on="area name")
by_div_cat["pct"] = (by_div_cat["area_m2"] / by_div_cat["total_m2"] * 100).round(2)

result = (
    by_div_cat.pivot(index="area name", columns="CATEGORY", values="pct")
    .fillna(0)
    .reset_index()
)

OUT_ZONING.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_ZONING, "w", encoding="utf-8") as f:
    json.dump(json.loads(result.to_json(orient="records")), f)
print(f"  {len(result)} divisions -> {OUT_ZONING}")
print(result.set_index("area name").round(1).to_string())
