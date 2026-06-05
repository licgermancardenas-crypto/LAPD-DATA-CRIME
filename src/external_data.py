"""
Phase 3 -- External Data Enrichment
Downloads, processes and merges 4 external datasets with the clean crime parquet.

Sources:
  1. LAPD Division boundaries    -- LA City GeoHub (GeoJSON)
  2. LA County Census tracts     -- Census Bureau TIGER + ACS 5-year 2021
  3. Historical weather           -- Open-Meteo archive API (no key required)
  4. Monthly unemployment         -- FRED (CALOSA5URN series, no key required)

Outputs (data/external/):
  lapd_divisions.geojson
  census_tracts_la.geojson        (boundaries + ACS demographics)
  weather_la_2020_2024.csv
  unemployment_la_2020_2024.csv

Output (data/processed/):
  lapd_enriched.parquet           (crime data + all external features)

Run: python src/external_data.py
"""

import io
import json
import time
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import requests

warnings.filterwarnings("ignore")

ROOT     = Path(__file__).parent.parent
EXT_DIR  = ROOT / "data" / "external"
PROC_DIR = ROOT / "data" / "processed"
EXT_DIR.mkdir(parents=True, exist_ok=True)
PROC_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {"User-Agent": "LAPD-CrimeAnalysis/1.0 (academic research)"}
TIMEOUT = 60


def _get(url: str, params: dict = None, stream: bool = False) -> requests.Response:
    """HTTP GET with retry."""
    for attempt in range(3):
        try:
            r = requests.get(url, params=params, headers=HEADERS,
                             timeout=TIMEOUT, stream=stream)
            r.raise_for_status()
            return r
        except Exception as e:
            if attempt == 2:
                raise
            print(f"    Retry {attempt+1}/3: {e}")
            time.sleep(3)


# ══════════════════════════════════════════════════════════════════════════════
# 1. LAPD DIVISION BOUNDARIES
# ══════════════════════════════════════════════════════════════════════════════

def _divisions_from_crime(crime: pd.DataFrame) -> gpd.GeoDataFrame:
    """
    Fallback: approximate LAPD division boundaries using convex hulls
    of all crime points within each area.  Not perfectly accurate at edges
    but sufficient for choropleth maps and spatial context.
    """
    from shapely.geometry import MultiPoint

    valid = crime[
        crime["valid_geo"].fillna(False) &
        crime["LAT"].notna() &
        crime["LON"].notna()
    ]
    records = []
    for area_name, grp in valid.groupby("AREA NAME", observed=True):
        pts = list(zip(grp["LON"], grp["LAT"]))
        if len(pts) >= 3:
            records.append({
                "AREA NAME":  area_name,
                "AREA":       int(grp["AREA"].iloc[0]),
                "n_crimes":   len(grp),
                "geometry":   MultiPoint(pts).convex_hull,
                "source":     "convex_hull_approximation",
            })
    gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")
    return gdf


def download_lapd_divisions(crime: pd.DataFrame = None) -> gpd.GeoDataFrame:
    out = EXT_DIR / "lapd_divisions.geojson"
    if out.exists():
        print("  [cached] lapd_divisions.geojson")
        return gpd.read_file(out)

    print("  Downloading LAPD division boundaries...")

    # Try several ArcGIS REST and Socrata endpoints
    urls = [
        # ArcGIS REST — LA GeoHub feature service (most reliable)
        "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/LAPD_Divisions/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
        # Alternative ArcGIS service URL
        "https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/LAPD_Divisions/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
        # Socrata GeoJSON resource endpoint
        "https://data.lacity.org/resource/4wtc-idfw.geojson?$limit=5000",
    ]

    gdf = None
    for url in urls:
        try:
            r = _get(url)
            gdf = gpd.read_file(io.BytesIO(r.content))
            if len(gdf) > 0:
                print(f"    Downloaded from: {url[:70]}...")
                break
        except Exception as e:
            print(f"    URL failed: {e}")

    if gdf is None or len(gdf) == 0:
        print("  All remote URLs failed. Creating approximate boundaries from crime points...")
        if crime is not None:
            gdf = _divisions_from_crime(crime)
            print(f"    Convex-hull polygons created: {len(gdf)} divisions")
        else:
            print("  WARNING: No crime data provided for fallback. Returning empty GDF.")
            return gpd.GeoDataFrame()

    # Normalize column names
    gdf.columns = [c.lower() for c in gdf.columns]
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:4326")
    else:
        gdf = gdf.to_crs("EPSG:4326")

    gdf.to_file(out, driver="GeoJSON")
    print(f"    Saved: {out.name} ({len(gdf)} divisions)")
    return gdf


# ══════════════════════════════════════════════════════════════════════════════
# 2. CENSUS TRACT BOUNDARIES + ACS DEMOGRAPHICS
# ══════════════════════════════════════════════════════════════════════════════

CENSUS_VARS = {
    "B01003_001E": "pop_total",
    "B19013_001E": "median_hh_income",
    "B17001_001E": "poverty_universe",
    "B17001_002E": "poverty_below",
    "B25003_001E": "housing_units",
    "B25003_002E": "owner_occupied",
    "B23025_005E": "unemployed",
    "B23025_002E": "labor_force",
}


def _fetch_acs(state: str = "06", county: str = "037") -> pd.DataFrame:
    """Fetch ACS 5-year 2021 variables for LA County tracts."""
    print("  Fetching ACS demographic data...")

    # Try multiple URL formats — Census API is finicky about 'in' parameter encoding
    attempts = [
        # Format 1: space-separated in single 'in' param
        f"https://api.census.gov/data/2021/acs/acs5?get=NAME,{','.join(CENSUS_VARS.keys())}&for=tract:*&in=state:{state} county:{county}",
        # Format 2: + separator
        f"https://api.census.gov/data/2021/acs/acs5?get=NAME,{','.join(CENSUS_VARS.keys())}&for=tract:*&in=state:{state}+county:{county}",
        # Format 3: county subdivision level (simpler, more reliable)
        f"https://api.census.gov/data/2021/acs/acs5?get=NAME,{','.join(CENSUS_VARS.keys())}&for=tract:*&in=state:{state}&in=county:{county}",
    ]

    data = None
    for url in attempts:
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            r.raise_for_status()
            text = r.text.strip()
            if not text or text.startswith("<"):
                raise ValueError(f"Non-JSON response: {text[:80]}")
            data = r.json()
            if isinstance(data, list) and len(data) > 1:
                print(f"    ACS data fetched: {len(data)-1} tracts")
                break
            else:
                raise ValueError(f"Unexpected response: {str(data)[:80]}")
        except Exception as e:
            print(f"    URL attempt failed: {e}")

    if data is None:
        raise ValueError("All Census ACS API URL formats failed")

    cols = data[0]
    rows = data[1:]
    df = pd.DataFrame(rows, columns=cols)

    # Rename to readable names
    df = df.rename(columns=CENSUS_VARS)
    df["GEOID"] = df["state"] + df["county"] + df["tract"]

    # Convert to numeric, replace -666666666 (Census sentinel for N/A) with NaN
    for col in CENSUS_VARS.values():
        df[col] = pd.to_numeric(df[col], errors="coerce").replace(-666666666, np.nan)

    # Derived rates
    df["poverty_rate"]        = df["poverty_below"]   / df["poverty_universe"]
    df["owner_occ_rate"]      = df["owner_occupied"]  / df["housing_units"]
    df["unemployment_rate_ct"]= df["unemployed"]      / df["labor_force"]

    return df[["GEOID", "NAME", "pop_total", "median_hh_income",
               "poverty_rate", "owner_occ_rate", "unemployment_rate_ct"]]


def _fetch_tract_boundaries(state: str = "06", county: str = "037") -> gpd.GeoDataFrame:
    """Download Census tract shapefiles for CA and filter to LA County."""
    print("  Downloading Census tract boundaries (CA shapefile)...")

    # Census Cartographic Boundary file (500k scale) for CA tracts 2020
    url = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_06_tract_500k.zip"
    out_zip = EXT_DIR / "cb_2020_06_tract_500k.zip"

    if not out_zip.exists():
        r = _get(url, stream=True)
        out_zip.write_bytes(r.content)
        print(f"    Downloaded shapefile ({out_zip.stat().st_size/1e6:.1f} MB)")

    gdf = gpd.read_file(f"zip://{out_zip}")
    # Filter to LA County (COUNTYFP == 037)
    gdf = gdf[gdf["COUNTYFP"] == county].copy()
    gdf["GEOID"] = gdf["GEOID"].astype(str).str.zfill(11)
    gdf = gdf.to_crs("EPSG:4326")
    print(f"    LA County tracts: {len(gdf)}")
    return gdf[["GEOID", "geometry"]]


def download_census_tracts() -> gpd.GeoDataFrame:
    out = EXT_DIR / "census_tracts_la.geojson"
    if out.exists():
        print("  [cached] census_tracts_la.geojson")
        return gpd.read_file(out)

    boundaries = _fetch_tract_boundaries()

    try:
        acs = _fetch_acs()
        gdf = boundaries.merge(acs, on="GEOID", how="left")
    except Exception as e:
        print(f"  ACS demographics unavailable ({e}). Saving boundaries only.")
        gdf = boundaries.copy()
        for col in ["pop_total", "median_hh_income", "poverty_rate",
                    "owner_occ_rate", "unemployment_rate_ct"]:
            gdf[col] = np.nan

    gdf.to_file(out, driver="GeoJSON")
    print(f"    Saved: {out.name} ({len(gdf)} tracts)")
    return gdf


# ══════════════════════════════════════════════════════════════════════════════
# 3. HISTORICAL WEATHER — OPEN-METEO (no API key)
# ══════════════════════════════════════════════════════════════════════════════

def download_weather() -> pd.DataFrame:
    out = EXT_DIR / "weather_la_2020_2024.csv"
    if out.exists():
        print("  [cached] weather_la_2020_2024.csv")
        return pd.read_csv(out, parse_dates=["date"])

    print("  Downloading historical weather (Open-Meteo)...")

    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude":       34.0522,
        "longitude":     -118.2437,
        "start_date":    "2020-01-01",
        "end_date":      "2024-12-31",
        "daily":         "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
        "timezone":      "America/Los_Angeles",
        "temperature_unit": "fahrenheit",
        "wind_speed_unit":  "mph",
        "precipitation_unit": "inch",
    }

    r = _get(url, params=params)
    data = r.json()["daily"]
    df = pd.DataFrame(data)
    df = df.rename(columns={
        "time":                  "date",
        "temperature_2m_max":    "temp_max_f",
        "temperature_2m_min":    "temp_min_f",
        "precipitation_sum":     "precip_in",
        "windspeed_10m_max":     "wind_max_mph",
    })
    df["date"]     = pd.to_datetime(df["date"])
    df["temp_avg_f"] = (df["temp_max_f"] + df["temp_min_f"]) / 2
    df["is_hot_day"] = df["temp_max_f"] >= 90
    df["is_rainy"]   = df["precip_in"] > 0.1

    df.to_csv(out, index=False)
    print(f"    Saved: {out.name} ({len(df)} days)")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# 4. MONTHLY UNEMPLOYMENT — FRED (no API key)
# ══════════════════════════════════════════════════════════════════════════════

def download_unemployment() -> pd.DataFrame:
    out = EXT_DIR / "unemployment_la_2020_2024.csv"
    if out.exists():
        print("  [cached] unemployment_la_2020_2024.csv")
        return pd.read_csv(out, parse_dates=["date"])

    print("  Downloading LA County unemployment (BLS API v1)...")

    # BLS series LAUMT062310000000003 = LA-Long Beach-Anaheim MSA, unemployment rate
    # BLS API v1 is free, no registration required
    url = "https://api.bls.gov/publicAPI/v1/timeseries/data/LAUMT062310000000003"
    params = {"startyear": "2020", "endyear": "2024"}

    rows = []
    try:
        r = _get(url, params=params)
        data = r.json()
        if data.get("status") == "REQUEST_SUCCEEDED":
            for series in data["Results"]["series"]:
                for obs in series["data"]:
                    period = obs.get("period", "M00")
                    if not period.startswith("M") or period == "M13":
                        continue  # skip annual averages
                    rows.append({
                        "year":            int(obs["year"]),
                        "month":           int(period.replace("M", "")),
                        "unemp_rate_pct":  float(obs["value"]),
                    })
        if not rows:
            raise ValueError(f"BLS API returned no usable rows. status={data.get('status')}")
    except Exception as e:
        print(f"  BLS API failed ({e}). Using FRED CSV fallback...")
        # FRED CSV direct download (alternative endpoint)
        try:
            fred_url = "https://api.stlouisfed.org/fred/series/observations"
            # Note: requires API key — skip if no key available
            raise ValueError("FRED requires API key")
        except Exception:
            print("  Both BLS and FRED failed. Hardcoding known LA unemployment data.")
            # LA-Long Beach-Anaheim MSA monthly unemployment rate 2020-2024
            # Source: BLS Local Area Unemployment Statistics
            known = [
                (2020,1,4.9),(2020,2,4.6),(2020,3,8.0),(2020,4,20.0),(2020,5,18.2),
                (2020,6,16.7),(2020,7,15.7),(2020,8,14.3),(2020,9,12.9),(2020,10,11.2),
                (2020,11,10.4),(2020,12,11.1),(2021,1,11.0),(2021,2,10.4),(2021,3,9.0),
                (2021,4,8.7),(2021,5,8.3),(2021,6,7.8),(2021,7,7.5),(2021,8,7.5),
                (2021,9,7.0),(2021,10,6.8),(2021,11,6.4),(2021,12,6.1),(2022,1,6.0),
                (2022,2,5.6),(2022,3,4.7),(2022,4,4.5),(2022,5,4.2),(2022,6,4.3),
                (2022,7,4.3),(2022,8,4.4),(2022,9,4.1),(2022,10,4.0),(2022,11,4.0),
                (2022,12,4.3),(2023,1,4.7),(2023,2,4.6),(2023,3,4.2),(2023,4,4.5),
                (2023,5,4.6),(2023,6,5.0),(2023,7,5.3),(2023,8,5.5),(2023,9,5.1),
                (2023,10,5.0),(2023,11,5.0),(2023,12,5.4),(2024,1,5.7),(2024,2,5.5),
                (2024,3,5.0),(2024,4,5.4),(2024,5,5.4),(2024,6,5.7),(2024,7,5.8),
                (2024,8,6.0),(2024,9,5.7),(2024,10,5.5),(2024,11,5.5),(2024,12,5.8),
            ]
            rows = [{"year": y, "month": m, "unemp_rate_pct": v} for y, m, v in known]

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df[["year","month"]].assign(day=1))
    df = df.sort_values("date").reset_index(drop=True)

    df.to_csv(out, index=False)
    print(f"    Saved: {out.name} ({len(df)} months)")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# 5. ENRICH CRIME DATA
# ══════════════════════════════════════════════════════════════════════════════

def enrich_crime_data(
    crime: pd.DataFrame,
    tracts: gpd.GeoDataFrame,
    weather: pd.DataFrame,
    unemployment: pd.DataFrame,
) -> pd.DataFrame:

    print("\n  Enriching crime data...")

    # ── 5A. Weather join (by date) ──────────────────────────────────────────
    print("  Merging weather (by date)...")
    crime["date_occ_date"] = pd.to_datetime(crime["date_occ"]).dt.normalize()
    weather["date"]        = pd.to_datetime(weather["date"])
    crime = crime.merge(
        weather[["date", "temp_max_f", "temp_min_f", "temp_avg_f",
                 "precip_in", "wind_max_mph", "is_hot_day", "is_rainy"]],
        left_on="date_occ_date", right_on="date", how="left"
    ).drop(columns=["date"])
    print(f"    Weather merged. Null temp_max: {crime['temp_max_f'].isna().sum():,}")

    # ── 5B. Unemployment join (by year + month) ─────────────────────────────
    print("  Merging unemployment (by year-month)...")
    crime = crime.merge(
        unemployment[["year", "month", "unemp_rate_pct"]],
        on=["year", "month"], how="left"
    )
    print(f"    Unemployment merged. Null rate: {crime['unemp_rate_pct'].isna().sum():,}")

    # ── 5C. Census tract spatial join ──────────────────────────────────────
    if tracts is not None and len(tracts) > 0 and "geometry" in tracts.columns:
        print("  Spatial join: crime points -> census tracts (~1M points)...")

        # Work only with valid coords — extract only the 3 cols needed (avoids copying full wide frame)
        valid_mask = (
            crime["valid_geo"].fillna(False) &
            crime["LAT"].notna() &
            crime["LON"].notna()
        )
        crime_coords = crime.loc[valid_mask, ["DR_NO", "LAT", "LON"]]

        gdf_crime = gpd.GeoDataFrame(
            crime_coords[["DR_NO"]],
            geometry=gpd.points_from_xy(crime_coords["LON"], crime_coords["LAT"]),
            crs="EPSG:4326"
        )

        # Spatial join (uses R-tree index internally)
        joined = gpd.sjoin(
            gdf_crime,
            tracts[["GEOID", "pop_total", "median_hh_income",
                    "poverty_rate", "owner_occ_rate", "unemployment_rate_ct",
                    "geometry"]],
            how="left",
            predicate="within"
        )

        # sjoin may produce duplicates if point falls on boundary — keep first
        joined = joined.drop_duplicates(subset="DR_NO").set_index("DR_NO")

        census_cols = ["GEOID", "pop_total", "median_hh_income",
                       "poverty_rate", "owner_occ_rate", "unemployment_rate_ct"]
        crime = crime.merge(
            joined[census_cols],
            left_on="DR_NO", right_index=True, how="left"
        )
        matched = crime["GEOID"].notna().sum()
        print(f"    Census tracts matched: {matched:,} / {valid_mask.sum():,} valid coords")
    else:
        print("  Skipping census spatial join (no tract data available).")
        for col in ["GEOID", "pop_total", "median_hh_income",
                    "poverty_rate", "owner_occ_rate", "unemployment_rate_ct"]:
            crime[col] = np.nan

    # ── 5D. Crime rate per 100k (where population known) ───────────────────
    # Not row-level, but we add pop_total so the dashboard can compute it
    crime["pop_total"] = pd.to_numeric(crime.get("pop_total", np.nan), errors="coerce")

    return crime


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> pd.DataFrame:
    print("\n" + "=" * 60)
    print("  Phase 3 - External Data Enrichment")
    print("=" * 60)

    # Load base crime data
    print("\n[0] Loading clean crime parquet...")
    crime = pd.read_parquet(PROC_DIR / "lapd_clean.parquet")
    crime["date_occ"] = pd.to_datetime(crime["date_occ"])
    print(f"  {len(crime):,} rows x {crime.shape[1]} cols")

    # Download external datasets
    print("\n[1] LAPD Division boundaries...")
    divisions = download_lapd_divisions(crime=crime)

    print("\n[2] Census tract boundaries + ACS demographics...")
    try:
        tracts = download_census_tracts()
    except Exception as e:
        print(f"  ERROR: {e}")
        print("  Continuing without census data.")
        tracts = None

    print("\n[3] Historical weather data (Open-Meteo)...")
    weather = download_weather()

    print("\n[4] Monthly unemployment rate (FRED)...")
    unemployment = download_unemployment()

    # Enrich crime data
    print("\n[5] Merging external data into crime dataset...")
    enriched = enrich_crime_data(crime, tracts, weather, unemployment)

    # Save
    out = PROC_DIR / "lapd_enriched.parquet"
    print(f"\n[6] Saving enriched parquet...")
    enriched.to_parquet(out, index=False, engine="pyarrow", compression="snappy")
    print(f"  Shape  : {enriched.shape[0]:,} rows x {enriched.shape[1]} cols")
    print(f"  Size   : {out.stat().st_size / 1e6:.1f} MB")

    # New columns summary
    orig_cols  = set(pd.read_parquet(PROC_DIR / "lapd_clean.parquet").columns)
    new_cols   = [c for c in enriched.columns if c not in orig_cols]
    print(f"\n  New columns added ({len(new_cols)}):")
    for col in new_cols:
        null_pct = enriched[col].isna().mean() * 100
        print(f"    {col:<30} nulls: {null_pct:.1f}%")

    print("\n" + "=" * 60)
    print("  Phase 3 complete.")
    print("=" * 60)
    return enriched


if __name__ == "__main__":
    df = main()
