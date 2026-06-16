"""
Convert Listing_of_All_Businesses CSV to Parquet (Snappy compression).

Usage:
    python scripts/csv_to_parquet_businesses.py
"""

import pandas as pd
from pathlib import Path
import time

SRC = Path(r"C:\Users\corra\Desktop\POWER BI Proyectos\L.APD crimes\Listing_of_All_Businesses_20260606\Listing_of_All_Businesses_20260606.csv")
OUT = SRC.parent / "businesses.parquet"

DTYPES = {
    "LOCATION ACCOUNT #":        "string",
    "BUSINESS NAME":             "string",
    "DBA NAME":                  "string",
    "STREET ADDRESS":            "string",
    "CITY":                      "string",
    "ZIP CODE":                  "string",
    "LOCATION DESCRIPTION":      "string",
    "MAILING ADDRESS":           "string",
    "MAILING CITY":              "string",
    "MAILING ZIP CODE":          "string",
    "NAICS":                     "string",   # keep as string: leading zeros & nulls
    "PRIMARY NAICS DESCRIPTION": "string",
    "COUNCIL DISTRICT":          "Int16",    # nullable int
    "LOCATION START DATE":       "string",
    "LOCATION END DATE":         "string",
    "LOCATION":                  "string",   # "(lat, lon)" format
}

print(f"Reading {SRC.name}  ({SRC.stat().st_size/1e6:.1f} MB)...")
t0 = time.time()

df = pd.read_csv(
    SRC,
    dtype=DTYPES,
    encoding="utf-8",
    on_bad_lines="skip",
    low_memory=False,
)

print(f"  Read {len(df):,} rows, {len(df.columns)} columns  ({time.time()-t0:.1f}s)")

# Parse dates — keep as datetime for efficient filtering later
for col in ("LOCATION START DATE", "LOCATION END DATE"):
    df[col] = pd.to_datetime(df[col], errors="coerce")

# Rename to snake_case for easier querying
df.columns = [c.lower().replace(" ", "_") for c in df.columns]

# Strip the NAICS code to integer where possible (still stored as string for safety)
df["naics"] = df["naics"].str.split(".").str[0]  # drop decimal artifact

print(f"Writing -> {OUT.name}  (snappy)...")
t1 = time.time()
df.to_parquet(OUT, engine="pyarrow", compression="snappy", index=False)
print(f"  Done in {time.time()-t1:.1f}s")

size_mb = OUT.stat().st_size / 1e6
ratio   = SRC.stat().st_size / OUT.stat().st_size
print(f"\nCSV:     {SRC.stat().st_size/1e6:.1f} MB")
print(f"Parquet: {size_mb:.1f} MB  (compression ratio {ratio:.1f}x)")
print(f"\nColumns saved:")
for col, dt in zip(df.columns, df.dtypes):
    null_pct = df[col].isna().mean() * 100
    print(f"  {col:<35} {str(dt):<12} {null_pct:5.1f}% null")
