"""
Fetch the City of LA zoning polygons (general zone + category, e.g.
Residential/Commercial/Manufacturing) from LA GeoHub.

The Hub's default .geojson export (geohub.lacity.org/datasets/lahub::zoning)
serves full-precision, full-attribute geometry -- 462 MB for 58,877 parcels.
This queries the underlying FeatureServer directly instead, paginated, with
just the 2 fields needed and geometry rounded to ~1m precision.

Source: https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15

Output: data/external/zoning_la.geojson

Run from repo root:
    python scripts/fetch_zoning.py
"""

import json
import time
from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "zoning_la.geojson"

BASE = "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15/query"
PAGE_SIZE = 2000

features = []
offset = 0
while True:
    params = {
        "where": "1=1",
        "outFields": "OBJECTID,Zoning,CATEGORY",
        "geometryPrecision": 5,
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
    print(f"  fetched {len(features):,} parcels so far...")
    offset += PAGE_SIZE
    time.sleep(0.2)

geojson = {"type": "FeatureCollection", "features": features}
OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(geojson, f)

print(f"\nSaved {len(features):,} zoning parcels -> {OUT}")
