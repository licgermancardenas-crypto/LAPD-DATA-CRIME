"""
Fetch streetlight point locations (Bureau of Street Lighting) from the City of
LA's ArcGIS service — the Socrata mirror (data.lacity.org id 9ei6-svt8) returns
empty records, so this hits the underlying FeatureServer directly.

Source: https://maps.lacity.org/lahub/rest/services/Bureau_of_Street_Lighting/MapServer/0
~222,000 points citywide, paginated at the service's maxRecordCount (5,000/page).

Output: data/external/streetlights_la.geojson

Run from repo root:
    python scripts/fetch_streetlights.py
"""

import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "streetlights_la.geojson"

BASE = "https://maps.lacity.org/lahub/rest/services/Bureau_of_Street_Lighting/MapServer/0/query"
PAGE_SIZE = 5000

features = []
offset = 0
while True:
    params = {
        "where": "1=1",
        "outFields": "OBJECTID,STATUS,POSTDESC",
        "geometryPrecision": 6,
        "resultOffset": offset,
        "resultRecordCount": PAGE_SIZE,
        "f": "geojson",
    }
    r = requests.get(BASE, params=params, timeout=60)
    r.raise_for_status()
    page = r.json().get("features", [])
    if not page:
        break
    features.extend(page)
    print(f"  fetched {len(features):,} points so far...")
    offset += PAGE_SIZE
    time.sleep(0.3)

geojson = {"type": "FeatureCollection", "features": features}
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(geojson, f)

print(f"\nSaved {len(features):,} streetlights -> {OUT}")
