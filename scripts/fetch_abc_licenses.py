"""
Fetch California ABC (Alcoholic Beverage Control) active license data,
filtered to LA County, aggregated to Census tract level.

Source: https://www.abc.ca.gov/wp-content/uploads/DailyExport-CSV.zip
Statewide daily export, refreshed 7am PT. Includes "Prem Census Tract #"
directly -- no geocoding needed, unlike most address-only bulk exports.

License type classification (standard ABC codes):
  off-sale (retail, take-away)   -- 20 (beer & wine), 21 (general/full liquor)
  on-sale  (consume on premise)  -- 40/41/42 (beer/beer&wine), 47/48/49/50 (general)
  other                          -- everything else (wholesale, manufacturer, etc.)

Output: data/external/abc_licenses_by_tract.csv

Run from repo root:
    python scripts/fetch_abc_licenses.py
"""

import io
import zipfile
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "abc_licenses_by_tract.csv"
URL = "https://www.abc.ca.gov/wp-content/uploads/DailyExport-CSV.zip"

OFF_SALE = {"20", "21"}
ON_SALE = {"40", "41", "42", "47", "48", "49", "50"}


def classify(license_type: str) -> str:
    t = str(license_type).strip().zfill(2)
    if t in OFF_SALE:
        return "off_sale"
    if t in ON_SALE:
        return "on_sale"
    return "other"


print("Downloading ABC daily export...")
r = requests.get(URL, timeout=60)
r.raise_for_status()

with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
    csv_name = [n for n in zf.namelist() if n.endswith(".csv")][0]
    df = pd.read_csv(zf.open(csv_name), skiprows=1, dtype=str)

print(f"  {len(df):,} statewide records")

la = df[(df["Prem County"] == "LOS ANGELES") & (df["Type Status"] == "ACTIVE")].copy()
la["tract6"] = pd.to_numeric(la["Prem Census Tract #"], errors="coerce")
la = la.dropna(subset=["tract6"])
la["tract6"] = (la["tract6"] * 100).round().astype(int).astype(str).str.zfill(6)
la["GEOID"] = "06037" + la["tract6"]
la["category"] = la["License Type"].apply(classify)

print(f"  {len(la):,} active LA County licenses")

by_tract = (
    la.groupby(["GEOID", "category"])
    .size()
    .unstack("category", fill_value=0)
    .reset_index()
)
for col in ["off_sale", "on_sale", "other"]:
    if col not in by_tract.columns:
        by_tract[col] = 0
by_tract["total_licenses"] = by_tract["off_sale"] + by_tract["on_sale"] + by_tract["other"]

OUT.parent.mkdir(parents=True, exist_ok=True)
by_tract.to_csv(OUT, index=False)
print(f"\nSaved {len(by_tract):,} tracts -> {OUT}")
print(f"  Total off-sale: {by_tract['off_sale'].sum():,}  on-sale: {by_tract['on_sale'].sum():,}  other: {by_tract['other'].sum():,}")
