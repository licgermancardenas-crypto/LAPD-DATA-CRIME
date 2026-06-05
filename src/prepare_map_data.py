"""
Fetch real LAPD Division polygons from ArcGIS REST API,
merge with crime stats, save GeoJSON for the Leaflet map.
"""
import json, requests, pandas as pd
from pathlib import Path

ROOT   = Path(__file__).resolve().parent.parent
PROC   = ROOT / "data" / "processed"
OUTDIR = ROOT / "dashboard" / "public" / "data"
OUTDIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. Fetch LAPD Division polygons (ArcGIS paginates at resultRecordCount max)
# ---------------------------------------------------------------------------
BASE = (
    "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services"
    "/LAPD_Division/FeatureServer/0/query"
)

def fetch_all_divisions():
    features = []
    offset = 0
    batch  = 10
    while True:
        params = {
            "where": "1=1",
            "outFields": "APREC,PREC",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": batch,
        }
        r = requests.get(BASE, params=params, timeout=30)
        r.raise_for_status()
        fc = r.json()
        chunk = fc.get("features", [])
        features.extend(chunk)
        print(f"  fetched {len(chunk)} (total {len(features)})")
        # stop if fewer results than batch (last page) or empty
        if len(chunk) < batch or not chunk:
            break
        offset += batch
    return features

print("Fetching LAPD Division polygons ...")
features = fetch_all_divisions()
print(f"  -> {len(features)} division polygons")

# ---------------------------------------------------------------------------
# 2. Load crime stats per division (from Phase 4A aggregation)
# ---------------------------------------------------------------------------
agg_path = ROOT / "data" / "powerbi" / "agg_division_cat.csv"
if agg_path.exists():
    agg = pd.read_csv(agg_path)
    # total crimes per division
    # agg_division_cat.csv columns: AREA NAME, crime_category, crimes, violent, cleared, clearance_rate_pct
    div_totals = (
        agg.groupby("AREA NAME")["crimes"]
        .sum()
        .reset_index()
        .rename(columns={"AREA NAME": "area_name", "crimes": "total_crimes"})
    )
    # clearance per division (average across categories)
    clear_div = (
        agg.groupby("AREA NAME")
        .apply(lambda x: (x["cleared"].sum() / x["crimes"].sum() * 100) if x["crimes"].sum() > 0 else 0)
        .reset_index()
    )
    clear_div.columns = ["area_name", "clearance_rate"]
    div_totals = div_totals.merge(clear_div, on="area_name", how="left")
    # top category per division
    top_cat = (
        agg.sort_values("crimes", ascending=False)
        .groupby("AREA NAME")
        .first()
        .reset_index()[["AREA NAME", "crime_category"]]
        .rename(columns={"AREA NAME": "area_name", "crime_category": "top_category"})
    )
    div_totals = div_totals.merge(top_cat, on="area_name", how="left")
else:
    # fallback: use local divisions geojson counts
    local = ROOT / "data" / "external" / "lapd_divisions.geojson"
    with open(local) as f:
        lj = json.load(f)
    div_totals = pd.DataFrame([
        {"AREA": p["properties"]["area"],
         "area_name": p["properties"]["area name"].upper(),
         "total_crimes": p["properties"]["n_crimes"]}
        for p in lj["features"]
    ])

# Normalize names for join
div_totals["key"] = div_totals["area_name"].str.upper().str.strip()
div_totals["total_crimes"] = div_totals["total_crimes"].fillna(0).astype(int)
stats = div_totals.set_index("key").to_dict("index")

print(f"  crime stats for {len(stats)} divisions")
for k, v in sorted(stats.items()):
    print(f"    {k}: {v.get('total_crimes', 0):,} crimes")

# ---------------------------------------------------------------------------
# 3. Merge stats into GeoJSON features
# ---------------------------------------------------------------------------
all_crimes = [v.get("total_crimes", 0) for v in stats.values() if v.get("total_crimes")]
max_crimes = max(all_crimes) if all_crimes else 1
min_crimes = min(all_crimes) if all_crimes else 0

enriched = []
for feat in features:
    props = feat["properties"]
    aprec = (props.get("APREC") or "").upper().strip()
    row   = stats.get(aprec, {})

    total   = int(row.get("total_crimes", 0))
    norm    = round((total - min_crimes) / max(max_crimes - min_crimes, 1), 4)
    clear   = round(float(row.get("clearance_rate", 0)), 2)
    top_cat = row.get("top_category", "Unknown")
    prec    = props.get("PREC", 0)

    feat["properties"] = {
        "name":         aprec,
        "prec":         prec,
        "total_crimes": total,
        "norm":         norm,          # 0-1 for color scale
        "clearance":    clear,
        "top_category": top_cat,
    }
    enriched.append(feat)

# ---------------------------------------------------------------------------
# 4. Save
# ---------------------------------------------------------------------------
out = {
    "type": "FeatureCollection",
    "features": enriched,
    "_meta": {
        "source": "ArcGIS LAPD_Division FeatureServer",
        "crime_stats": "lapd_enriched.parquet Phase4A aggregation",
        "n_divisions": len(enriched),
        "max_crimes":  int(max_crimes),
        "min_crimes":  int(min_crimes),
    }
}
out_path = OUTDIR / "lapd_divisions_crimes.geojson"
with open(out_path, "w") as f:
    json.dump(out, f, separators=(",", ":"))

kb = out_path.stat().st_size / 1024
print(f"\nSaved {out_path.name}  ({kb:.0f} KB, {len(enriched)} features)")
print("Done.")
