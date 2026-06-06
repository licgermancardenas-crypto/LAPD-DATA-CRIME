"""
Generate dashboard/public/data/tract_crimes_per_1000.geojson

Sources:
  - Crime incidents: LAPD Open Data (Socrata API) - lat/lon per incident
  - Population:      Census Reporter API (ACS 5-yr, no key required)
  - Boundaries:      data/external/census_tracts_la.geojson

Run from repo root:
    pip install geopandas pandas requests shapely
    python scripts/generate_tract_data.py

Output: dashboard/public/data/tract_crimes_per_1000.geojson
"""

import json, requests, time
from pathlib import Path
import pandas as pd
import geopandas as gpd

ROOT   = Path(__file__).parent.parent
OUT    = ROOT / "dashboard/public/data/tract_crimes_per_1000.geojson"
TRACTS = ROOT / "data/external/census_tracts_la.geojson"

# ── 1. Load census tract boundaries ───────────────────────────────────────
print("Loading census tract boundaries...")
tracts = gpd.read_file(TRACTS)
print(f"  {len(tracts)} tracts, CRS: {tracts.crs}")
if tracts.crs is None or tracts.crs.to_epsg() != 4326:
    tracts = tracts.to_crs(4326)

tracts["tract6"] = tracts["GEOID"].str[-6:]

# ── 2. Population from Census Reporter (no API key required) ──────────────
print("Fetching population from Census Reporter API (LA County tracts)...")
# geo_ids: all tract-level (140) within LA County (05000US06037)
cr_url = (
    "https://api.censusreporter.org/1.0/data/show/latest"
    "?table_ids=B01003"
    "&geo_ids=140|05000US06037"
)
resp = requests.get(cr_url, timeout=120)
resp.raise_for_status()
cr_data = resp.json()["data"]

pop_rows = []
for geo_id, tables in cr_data.items():
    # geo_id format: "14000US06037300100" → GEOID = last 11 chars
    geoid = geo_id.replace("14000US", "")
    pop   = tables.get("B01003", {}).get("estimate", {}).get("B01003001", 0)
    pop_rows.append({"GEOID": geoid, "population": int(pop or 0)})

pop_df = pd.DataFrame(pop_rows)
print(f"  {len(pop_df)} tracts with population data")

# ── 3. Crime incidents from LAPD Socrata API ──────────────────────────────
print("Downloading crime coordinates from LAPD Open Data (a few minutes)...")
SOCRATA   = "https://data.lacity.org/resource/2nrs-mtv8.json"
APP_TOKEN = ""   # optional — add your Socrata app token for higher rate limits

records = []
limit   = 50_000
offset  = 0
headers = {"X-App-Token": APP_TOKEN} if APP_TOKEN else {}

while True:
    params = {
        "$select": "LAT,LON,date_occ",
        "$where": "LAT IS NOT NULL AND LON IS NOT NULL AND LAT != 0 AND LON != 0",
        "$limit":  limit,
        "$offset": offset,
        "$order":  ":id",
    }
    r = requests.get(SOCRATA, params=params, headers=headers, timeout=120)
    r.raise_for_status()
    batch = r.json()
    if not batch:
        break
    records.extend(batch)
    offset += limit
    print(f"  downloaded {len(records):,} records...", end="\r")
    if len(batch) < limit:
        break
    time.sleep(0.3)

print(f"\n  total: {len(records):,} crime incidents with coordinates")

crimes_df = pd.DataFrame(records)
crimes_df["LAT"] = pd.to_numeric(crimes_df["LAT"], errors="coerce")
crimes_df["LON"] = pd.to_numeric(crimes_df["LON"], errors="coerce")
crimes_df = crimes_df.dropna(subset=["LAT", "LON"])
crimes_df = crimes_df[
    (crimes_df["LAT"].between(33.7, 34.4)) &
    (crimes_df["LON"].between(-118.7, -117.9))
]
print(f"  {len(crimes_df):,} incidents after coordinate filtering")

# ── 4. Spatial join: crimes → census tracts ───────────────────────────────
print("Building spatial join (crimes -> census tracts)...")
crime_gdf = gpd.GeoDataFrame(
    crimes_df,
    geometry=gpd.points_from_xy(crimes_df["LON"], crimes_df["LAT"]),
    crs=4326
)

joined = gpd.sjoin(
    crime_gdf[["geometry"]],
    tracts[["geometry", "GEOID", "tract6"]],
    how="left", predicate="within"
)
count_by_tract = joined.groupby("GEOID").size().reset_index(name="crime_count")
print(f"  crimes mapped to {count_by_tract['GEOID'].nunique()} tracts")

# ── 5. Assemble final GeoDataFrame ────────────────────────────────────────
print("Assembling final dataset...")
result = tracts.merge(pop_df, on="GEOID", how="left")
result = result.merge(count_by_tract, on="GEOID", how="left")
result["crime_count"] = result["crime_count"].fillna(0).astype(int)
result["population"]  = result["population"].fillna(0).astype(int)
result["crimes_per_1000"] = (
    result["crime_count"] / (result["population"] / 1000)
).where(result["population"] > 0, 0).round(1)

cap = result.loc[result["crimes_per_1000"] > 0, "crimes_per_1000"].quantile(0.99)
result["norm"] = (result["crimes_per_1000"] / cap).clip(0, 1).round(4)

def risk(v):
    if v == 0: return "No data"
    if v < 20: return "Low"
    if v < 50: return "Moderate"
    if v < 100: return "High"
    return "Very High"

result["risk"] = result["crimes_per_1000"].apply(risk)

keep = ["GEOID", "tract6", "population", "crime_count",
        "crimes_per_1000", "norm", "risk", "geometry"]
result = result[[c for c in keep if c in result.columns]]

# ── 6. Write GeoJSON ───────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
result.to_file(OUT, driver="GeoJSON")
print(f"\nDone -> {OUT}")
print(f"  tracts: {len(result)}")
print(f"  max crimes/1000: {result['crimes_per_1000'].max():.1f}")
print(f"  median crimes/1000: {result['crimes_per_1000'].median():.1f}")
print(f"  tracts with population > 0: {(result['population'] > 0).sum()}")
print(f"  tracts with crime data: {(result['crime_count'] > 0).sum()}")
