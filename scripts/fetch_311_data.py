"""
Fetch MyLA311 service request data (2020-2024) from data.lacity.org, aggregated
server-side to monthly counts by LAPD precinct (policeprecinct) and request type.

Source: Socrata SODA API, one dataset per year:
  2020 rq3b-xjk8 · 2021 97z7-y5bt · 2022 i5ke-k6by · 2023 4a4x-mna2 · 2024 b7dx-7gc3

`policeprecinct` values match the crime dataset's `AREA NAME` column directly
(e.g. "77TH STREET", "HOLLENBECK") — no fuzzy join needed.

Output: data/external/311_monthly_by_precinct.csv

Run from repo root:
    python scripts/fetch_311_data.py
"""

import time
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).parent.parent
OUT = ROOT / "data" / "external" / "311_monthly_by_precinct.csv"

DATASETS = {
    2020: "rq3b-xjk8",
    2021: "97z7-y5bt",
    2022: "i5ke-k6by",
    2023: "4a4x-mna2",
    2024: "b7dx-7gc3",
}

# Disorder-proxy request types (broken-windows literature) + infra signals.
# Excludes purely administrative types (Feedback, Report Water Waste).
REQUEST_TYPES = [
    "Bulky Items",
    "Graffiti Removal",
    "Metal/Household Appliances",
    "Illegal Dumping Pickup",
    "Homeless Encampment",
    "Electronic Waste",
    "Dead Animal Removal",
    "Multiple Streetlight Issue",
    "Single Streetlight Issue",
]

frames = []
for year, dataset_id in DATASETS.items():
    print(f"Fetching {year} ({dataset_id})...")
    url = f"https://data.lacity.org/resource/{dataset_id}.json"
    params = {
        "$select": "date_trunc_ym(createddate) as month, policeprecinct, requesttype, count(*) as n",
        "$where": "requesttype in(" + ",".join(f"'{t}'" for t in REQUEST_TYPES) + ") AND policeprecinct != ''",
        "$group": "month, policeprecinct, requesttype",
        "$limit": 50000,
    }
    r = requests.get(url, params=params, timeout=60)
    r.raise_for_status()
    rows = r.json()
    print(f"  {len(rows):,} month x precinct x type rows")
    frames.append(pd.DataFrame(rows))
    time.sleep(1)  # be polite to the public API

df = pd.concat(frames, ignore_index=True)
df["n"] = df["n"].astype(int)
df["month"] = pd.to_datetime(df["month"]).dt.strftime("%Y-%m")
df = df.sort_values(["month", "policeprecinct", "requesttype"]).reset_index(drop=True)

OUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUT, index=False)
print(f"\nSaved {len(df):,} rows -> {OUT}")
print(f"Months: {df['month'].min()} to {df['month'].max()}")
print(f"Precincts: {df['policeprecinct'].nunique()}")
