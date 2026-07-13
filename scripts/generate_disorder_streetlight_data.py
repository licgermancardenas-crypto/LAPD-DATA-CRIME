"""
Generate dashboard/public/data/disorder_monthly.json and
dashboard/public/data/streetlight_density.geojson from the newly-fetched
MyLA311 and Bureau of Street Lighting sources (see fetch_311_data.py /
fetch_streetlights.py).

disorder_monthly.json: "broken windows" proxy — monthly count of disorder-type
311 requests (bulky items, graffiti, illegal dumping, homeless encampment,
dead animal, streetlight outages) per LAPD division. `policeprecinct` in the
311 data matches `area name` in lapd_divisions.geojson 1:1 (case differs only).

streetlight_density.geojson: streetlight count per LAPD division, normalized
by active addresses (streetlights per 1,000 active addresses) — same
methodology as the Arrests module's density denominator.

Run from repo root:
    python scripts/generate_disorder_streetlight_data.py
"""

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).parent.parent
REQUESTS_311 = ROOT / "data" / "external" / "311_monthly_by_precinct.csv"
STREETLIGHTS = ROOT / "data" / "external" / "streetlights_la.geojson"
DIVISIONS_ADDR = ROOT / "dashboard" / "public" / "data" / "lapd_divisions_addresses.geojson"
OUT_DISORDER = ROOT / "dashboard" / "public" / "data" / "disorder_monthly.json"
OUT_STREETLIGHT = ROOT / "dashboard" / "public" / "data" / "streetlight_density.geojson"

STREETLIGHT_TYPES = {"Multiple Streetlight Issue", "Single Streetlight Issue"}

# ── 1. Disorder index: 311 monthly counts by division ─────────────────────
print("Building disorder_monthly.json...")
req = pd.read_csv(REQUESTS_311)
req["division"] = req["policeprecinct"].str.title()
# Match lapd_divisions.geojson's "area name" casing exactly for known edge cases
req["division"] = req["division"].replace({
    "77Th Street": "77th Street",
    "North Hollywood": "North Hollywood",
    "West Los Angeles": "West Los Angeles",
    "West Valley": "West Valley",
})

req["is_streetlight"] = req["requesttype"].isin(STREETLIGHT_TYPES)
monthly = (
    req.groupby(["month", "division", "is_streetlight"])["n"]
    .sum()
    .unstack("is_streetlight", fill_value=0)
    .rename(columns={False: "disorder_requests", True: "streetlight_requests"})
    .reset_index()
)
monthly["total_requests"] = monthly["disorder_requests"] + monthly["streetlight_requests"]

OUT_DISORDER.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_DISORDER, "w", encoding="utf-8") as f:
    json.dump(json.loads(monthly.to_json(orient="records")), f)
print(f"  {len(monthly):,} division x month rows -> {OUT_DISORDER}")

# ── 2. Streetlight density per division ─────────────────────────────────
print("Building streetlight_density.geojson...")
lights = gpd.read_file(STREETLIGHTS)
divs = gpd.read_file(DIVISIONS_ADDR)
if lights.crs != divs.crs:
    lights = lights.to_crs(divs.crs)

joined = gpd.sjoin(lights, divs[["area name", "geometry"]], how="inner", predicate="within")
counts = joined.groupby("area name").size().rename("streetlight_count")

divs = divs.merge(counts, on="area name", how="left")
divs["streetlight_count"] = divs["streetlight_count"].fillna(0).astype(int)
divs["streetlights_per_1000_addr"] = (
    divs["streetlight_count"] / divs["active_addresses"] * 1000
).round(2)

divs.to_file(OUT_STREETLIGHT, driver="GeoJSON")
print(f"  {len(divs)} divisions -> {OUT_STREETLIGHT}")
print(divs[["area name", "streetlight_count", "streetlights_per_1000_addr"]].to_string(index=False))
