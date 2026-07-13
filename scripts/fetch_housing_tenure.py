"""
Fetch ACS 5-year housing occupancy/tenure by Census tract for LA County from
Esri's Living Atlas ACS FeatureServer -- the Census ACS API itself
(api.census.gov) fails in this environment (see src/external_data.py's
_fetch_acs history), so this uses Esri's hosted mirror instead, same
workaround pattern as fetch_streetlights.py.

Fills the gap left when the census join fix (2026-07-12) dropped
owner_occ_rate from lapd_enriched.parquet for lack of a working source.

Source: ACS_Housing_Occupancy_and_Tenure_Unit_Value_Boundaries, tract layer
  https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/ACS_Housing_Occupancy_and_Tenure_Unit_Value_Boundaries/FeatureServer/2

Output: data/external/housing_tenure_la.csv (2,495 LA County tracts)

Run from repo root:
    python scripts/fetch_housing_tenure.py
"""

import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "housing_tenure_la.csv"

BASE = (
    "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/"
    "ACS_Housing_Occupancy_and_Tenure_Unit_Value_Boundaries/FeatureServer/2/query"
)
FIELDS = {
    "GEOID": "GEOID",
    "B25002_calc_pctVacE": "vacancy_rate",
    "B25003_calc_pctOwnE": "owner_occ_rate",
    "B25003_calc_pctRentE": "renter_occ_rate",
    "B25058_001E": "median_contract_rent",
    "B25077_001E": "median_home_value",
}
PAGE_SIZE = 50  # service maxRecordCount

rows = []
offset = 0
while True:
    params = {
        "where": "GEOID LIKE '06037%'",
        "outFields": ",".join(FIELDS.keys()),
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
        "returnGeometry": "false",
        "f": "json",
    }
    r = requests.get(BASE, params=params, timeout=60)
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        break
    rows.extend(f["attributes"] for f in feats)
    print(f"  fetched {len(rows):,} tracts so far...")
    offset += PAGE_SIZE
    time.sleep(0.2)

df = pd.DataFrame(rows).rename(columns=FIELDS)
OUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT, index=False)
print(f"\nSaved {len(df):,} LA County tracts -> {OUT}")
