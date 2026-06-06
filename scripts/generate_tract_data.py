"""
Generate dashboard/public/data/tract_crimes_per_1000.geojson

Sources:
  - Crime incidents: LAPD Open Data (Socrata API) - lat/lon per incident
  - Population:      Census Bureau 2020 Decennial PL (P1_001N) - LA County tracts
  - Boundaries:      data/external/census_tracts_la.geojson

Run from repo root:
    pip install geopandas pandas requests shapely pyarrow
    python scripts/generate_tract_data.py

Output: dashboard/public/data/tract_crimes_per_1000.geojson
"""

import json, requests, time
from pathlib import Path
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

ROOT   = Path(__file__).parent.parent
OUT    = ROOT / "dashboard/public/data/tract_crimes_per_1000.geojson"
TRACTS = ROOT / "data/external/census_tracts_la.geojson"

# ── 1. Load census tract boundaries ───────────────────────────────────────
print("Loading census tract boundaries...")
tracts = gpd.read_file(TRACTS)
print(f"  {len(tracts)} tracts, CRS: {tracts.crs}")
if tracts.crs is None or tracts.crs.to_epsg() != 4326:
    tracts = tracts.to_crs(4326)

# Extract 6-digit tract code from GEOID (last 6 chars: state06 + county037 + tract6)
tracts["tract6"] = tracts["GEOID"].str[-6:]

# ── 2. Population from Census 2020 Decennial PL ───────────────────────────
print("Fetching population from Census Bureau API (LA County)...")
census_url = (
    "https://api.census.gov/data/2020/dec/pl"
    "?get=P1_001N,NAME"
    "&for=tract:*"
    "&in=state:06%20county:037"
)
resp = requests.get(census_url, timeout=60)
resp.raise_for_status()
data = resp.json()
pop_df = pd.DataFrame(data[1:], columns=data[0])
pop_df = pop_df.rename(columns={"P1_001N": "population", "tract": "tract6"})
pop_df["population"] = pd.to_numeric(pop_df["population"], errors="coerce").fillna(0).astype(int)
pop_df = pop_df[["tract6", "population", "NAME"]]
print(f"  {len(pop_df)} tracts with population data")

# ── 3. Crime incidents from LAPD Socrata API ──────────────────────────────
print("Downloading crime coordinates from LAPD Open Data (this may take a few minutes)...")
SOCRATA = "https://data.lacity.org/resource/2nrs-mtv8.json"
APP_TOKEN = ""   # optional — add your token here for higher rate limits

records = []
limit  = 50_000
offset = 0
headers = {"X-App-Token": APP_TOKEN} if APP_TOKEN else {}

while True:
    params = {
        "$select": "LAT,LON,date_occ",
        "$where": "LAT IS NOT NULL AND LON IS NOT NULL AND LAT != 0 AND LON != 0",
        "$limit": limit,
        "$offset": offset,
        "$order": ":id",
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
    time.sleep(0.3)   # be polite to the API

print(f"\n  total: {len(records):,} crime incidents with coordinates")

crimes_df = pd.DataFrame(records)
crimes_df["LAT"] = pd.to_numeric(crimes_df["LAT"], errors="coerce")
crimes_df["LON"] = pd.to_numeric(crimes_df["LON"], errors="coerce")
crimes_df = crimes_df.dropna(subset=["LAT", "LON"])
# Clip to rough LA bounding box to drop bad coordinates
crimes_df = crimes_df[
    (crimes_df["LAT"].between(33.7, 34.4)) &
    (crimes_df["LON"].between(-118.7, -117.9))
]
print(f"  {len(crimes_df):,} incidents after coordinate filtering")

# ── 4. Spatial join: crimes → census tracts ───────────────────────────────
print("Building spatial join (crimes → census tracts)...")
crime_gdf = gpd.GeoDataFrame(
    crimes_df,
    geometry=gpd.points_from_xy(crimes_df["LON"], crimes_df["LAT"]),
    crs=4326
)

joined = gpd.sjoin(crime_gdf[["geometry"]], tracts[["geometry","GEOID","tract6"]], how="left", predicate="within")
count_by_tract = joined.groupby("tract6").size().reset_index(name="crime_count")
print(f"  crimes mapped to {count_by_tract['tract6'].nunique()} tracts")

# ── 5. Assemble final GeoDataFrame ────────────────────────────────────────
print("Assembling final dataset...")
result = tracts.merge(pop_df, on="tract6", how="left")
result = result.merge(count_by_tract, on="tract6", how="left")
result["crime_count"]    = result["crime_count"].fillna(0).astype(int)
result["population"]     = result["population"].fillna(0).astype(int)
result["crimes_per_1000"] = (
    result["crime_count"] / (result["population"] / 1000)
).where(result["population"] > 0, 0).round(1)

# Normalise 0-1 for choropleth colouring (cap at 99th percentile to avoid outlier distortion)
cap = result.loc[result["crimes_per_1000"] > 0, "crimes_per_1000"].quantile(0.99)
result["norm"] = (result["crimes_per_1000"] / cap).clip(0, 1).round(4)

# Risk label
def risk(v):
    if v == 0: return "No data"
    if v < 20: return "Low"
    if v < 50: return "Moderate"
    if v < 100: return "High"
    return "Very High"

result["risk"] = result["crimes_per_1000"].apply(risk)

# Keep only needed columns
keep = ["GEOID", "tract6", "NAME", "population", "crime_count",
        "crimes_per_1000", "norm", "risk", "geometry"]
result = result[[c for c in keep if c in result.columns]]

# ── 6. Write GeoJSON ───────────────────────────────────────────────────────
OUT.parent.mkdir(parents=True, exist_ok=True)
result.to_file(OUT, driver="GeoJSON")
print(f"\nDone → {OUT}")
print(f"  tracts: {len(result)}")
print(f"  max crimes/1000: {result['crimes_per_1000'].max():.1f}")
print(f"  median crimes/1000: {result['crimes_per_1000'].median():.1f}")
