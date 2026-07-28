"""
Fetch LA Metro Rail station points (real station locations, not line geometry).

Source: City of Los Angeles GeoHub, "Metro Rail Lines Stops" dataset
  https://geohub.lacity.org/datasets/lahub::metro-rail-lines-stops
Standard ArcGIS Hub export pattern -- append .geojson to the item page URL.
107 point features covering all LA Metro rail lines (B/D Red-Purple,
A Blue-old Silver merge, E Expo, C Green, K Crenshaw). This is genuinely
station locations (used by src/ml_transit_proximity.py for a distance
analysis) -- distinct from dashboard/public/data/la_metro_lines.geojson
(line/corridor geometry, no station points) and from
dashboard/public/data/stations_la.geojson (misleadingly named -- that one
is police/sheriff stations, not transit).

Output: data/external/metro_rail_stations.geojson

Run from repo root:
    python scripts/fetch_metro_stations.py
"""

from pathlib import Path

import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "metro_rail_stations.geojson"
URL = "https://geohub.lacity.org/datasets/lahub::metro-rail-lines-stops.geojson"


def main():
    print(f"Fetching {URL} ...")
    r = requests.get(URL, timeout=60)
    r.raise_for_status()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(r.content)

    import json
    gj = json.loads(r.content)
    print(f"  {len(gj['features'])} station points -> {OUT.relative_to(ROOT)}")
    names = [f["properties"].get("Station", "?") for f in gj["features"][:5]]
    print(f"  sample: {names}")


if __name__ == "__main__":
    main()
