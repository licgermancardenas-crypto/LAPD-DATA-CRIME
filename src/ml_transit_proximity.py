"""
Phase 5I -- Transit Proximity Analysis

Does crime concentrate near LA Metro rail stations? Naively counting
incidents by distance-to-nearest-station is meaningless on its own --
stations are built where people already are, so "more crime near
stations" could just be "more crime where more people live." The real
question is whether crime is over-represented near transit BEYOND what
population density alone would predict.

Method: for every incident (2020-01 to RELIABLE_CUTOFF, same window as
the hotspot phases), find its distance to the nearest of the 107 real
Metro rail station points (scripts/fetch_metro_stations.py -- point
locations, not the line/corridor geometry the OSIRIS MOBILITY layer
already uses). Bucket into distance bands. Build a population-weighted
NULL distribution by sampling points inside every Census tract
proportional to its population, and bucket those the same way. The
ratio of (share of crime in a band) to (share of population in that
band) is a concentration ratio: 1.0 = crime exactly tracks where people
live, >1 = crime over-represented near transit at that distance, <1 =
under-represented.

Run separately for All/Violent/Vehicle/Property (same groups as Phase
5G) since routine activity theory again predicts these shouldn't behave
the same way near a transit corridor.

Outputs (outputs/figures/): p5i_01_concentration_by_band.png
Outputs (outputs/reports/): transit_proximity_metrics.csv
Outputs (dashboard/public/data/): transit_proximity.json

Run: python src/ml_transit_proximity.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import geopandas as gpd
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.spatial import cKDTree
from shapely.geometry import Point

ROOT   = Path(__file__).parent.parent
PROC   = ROOT / "data" / "processed"
EXT    = ROOT / "data" / "external"
DASH   = ROOT / "dashboard" / "public" / "data"
FIGDIR = ROOT / "outputs" / "figures"
REPDIR = ROOT / "outputs" / "reports"
for d in (FIGDIR, REPDIR):
    d.mkdir(parents=True, exist_ok=True)

RELIABLE_CUTOFF = pd.Timestamp("2024-03-31")
START = pd.Timestamp("2020-01-01")
CRS_M = "EPSG:3310"  # California Albers, meters
RNG = np.random.default_rng(42)

BANDS = [
    (0,      250,   "0–250m"),
    (250,    500,   "250–500m"),
    (500,    1000,  "500m–1km"),
    (1000,   2000,  "1–2km"),
    (2000,   np.inf, "2km+"),
]
BAND_LABELS = [b[2] for b in BANDS]

CRIME_GROUPS = {
    "all":      {"label": "All Crime"},
    "violent":  {"label": "Violent Crime",  "col": "is_violent",     "val": True},
    "vehicle":  {"label": "Vehicle Crime",  "col": "crime_category", "val": "Vehicle Crime"},
    "property": {"label": "Property Crime", "col": "is_property",    "val": True},
}

POP_SAMPLE_TOTAL = 300_000

BG = "#0f1117"; SURFACE = "#1a1d27"; BLUE = "#4f8ef7"; GREEN = "#3ecf8e"
YELLOW = "#e0c066"; MUTED = "#7b82a0"; RED = "#f87171"; PURPLE = "#a78bfa"
GROUP_COLORS = {"all": BLUE, "violent": RED, "vehicle": YELLOW, "property": PURPLE}

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": "white",
    "xtick.color": MUTED, "ytick.color": MUTED,
    "text.color": "white", "grid.color": "#2a2d3a",
    "grid.linestyle": "--", "grid.alpha": 0.5,
})


def band_index(dist_m: np.ndarray) -> np.ndarray:
    idx = np.full(len(dist_m), len(BANDS) - 1, dtype=int)
    for i, (lo, hi, _) in enumerate(BANDS):
        idx[(dist_m >= lo) & (dist_m < hi)] = i
    return idx


def main():
    print("\n" + "=" * 60)
    print("  Phase 5I - Transit Proximity Analysis")
    print("=" * 60 + "\n")

    print("Loading Metro rail stations...")
    stations = gpd.read_file(EXT / "metro_rail_stations.geojson")[["Station", "geometry"]]
    stations_m = stations.to_crs(CRS_M)
    station_xy = np.column_stack([stations_m.geometry.x, stations_m.geometry.y])
    tree = cKDTree(station_xy)
    print(f"  {len(stations)} station points")

    print("Loading crime incidents...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                          columns=["date_occ", "LAT", "LON", "valid_geo",
                                   "is_violent", "is_property", "crime_category"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df = df[df["valid_geo"] & (df["LAT"] != 0) & (df["LON"] != 0)
            & (df["date_occ"] >= START) & (df["date_occ"] <= RELIABLE_CUTOFF)].copy()
    print(f"  {len(df):,} incidents in reliable window")

    pts = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["LON"], df["LAT"]), crs="EPSG:4326").to_crs(CRS_M)
    crime_xy = np.column_stack([pts.geometry.x, pts.geometry.y])
    print("Computing nearest-station distance for every incident...")
    crime_dist, _ = tree.query(crime_xy, k=1, workers=-1)
    df["dist_m"] = crime_dist
    df["band"] = band_index(crime_dist)

    print("\nBuilding population-weighted null distribution (sampling within tracts)...")
    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[["GEOID", "pop_total", "geometry"]]
    tracts["pop_total"] = pd.to_numeric(tracts["pop_total"], errors="coerce").fillna(0)
    total_pop = tracts["pop_total"].sum()
    tracts["n_sample"] = (tracts["pop_total"] / total_pop * POP_SAMPLE_TOTAL).round().astype(int)
    tracts = tracts[tracts["n_sample"] > 0]

    sampled = tracts.geometry.sample_points(tracts["n_sample"].tolist(), rng=42)
    pop_gdf = gpd.GeoDataFrame(geometry=sampled.explode(index_parts=False).reset_index(drop=True), crs=tracts.crs).to_crs(CRS_M)
    pop_xy = np.column_stack([pop_gdf.geometry.x, pop_gdf.geometry.y])
    print(f"  {len(pop_gdf):,} population-weighted sample points across {len(tracts)} tracts")

    pop_dist, _ = tree.query(pop_xy, k=1, workers=-1)
    pop_band = band_index(pop_dist)
    pop_counts = np.bincount(pop_band, minlength=len(BANDS))
    pop_share = pop_counts / pop_counts.sum()
    print(f"  Population share by band: {dict(zip(BAND_LABELS, pop_share.round(3)))}")

    print("\n[Computing concentration ratios per crime group...]")
    results = {}
    for gkey, g in CRIME_GROUPS.items():
        if gkey == "all":
            gdf = df
        else:
            gdf = df[df[g["col"]] == g["val"]]
        counts = np.bincount(gdf["band"], minlength=len(BANDS))
        share = counts / counts.sum()
        ratio = share / pop_share
        median_dist = gdf["dist_m"].median()
        results[gkey] = {
            "label": g["label"],
            "n": int(len(gdf)),
            "median_dist_m": round(float(median_dist), 1),
            "bands": [
                {"band": BAND_LABELS[i], "crime_count": int(counts[i]),
                 "crime_share": round(float(share[i]), 4),
                 "pop_share": round(float(pop_share[i]), 4),
                 "concentration_ratio": round(float(ratio[i]), 3)}
                for i in range(len(BANDS))
            ],
        }
        print(f"  [{gkey}] n={len(gdf):,}  median_dist={median_dist:.0f}m  "
              f"ratios={[round(r,2) for r in ratio]}")

    payload = {
        "window": f"{START.strftime('%Y-%m')} to {RELIABLE_CUTOFF.strftime('%Y-%m')}",
        "n_stations": len(stations),
        "pop_sample_n": int(pop_counts.sum()),
        "median_dist_population_m": round(float(np.median(pop_dist)), 1),
        "bands": BAND_LABELS,
        "groups": results,
    }
    out = DASH / "transit_proximity.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"\n  Saved {out.relative_to(ROOT)}")

    rows = []
    for gkey, r in results.items():
        for b in r["bands"]:
            rows.append({"group": gkey, **b})
    pd.DataFrame(rows).to_csv(REPDIR / "transit_proximity_metrics.csv", index=False)
    print("  Saved transit_proximity_metrics.csv")

    print("\n[Generating figure...]")
    fig, ax = plt.subplots(figsize=(10, 5.5), facecolor=BG)
    ax.set_facecolor(SURFACE)
    x = np.arange(len(BAND_LABELS))
    width = 0.2
    for i, gkey in enumerate(["all", "violent", "vehicle", "property"]):
        ratios = [b["concentration_ratio"] for b in results[gkey]["bands"]]
        bars = ax.bar(x + (i - 1.5) * width, ratios, width, label=results[gkey]["label"], color=GROUP_COLORS[gkey], alpha=0.9)
        ax.bar_label(bars, fmt="%.2f", fontsize=7, color="white", padding=2)
    ax.axhline(1.0, color=MUTED, lw=1, ls="--")
    ax.set_xticks(x); ax.set_xticklabels(BAND_LABELS, fontsize=10)
    ax.set_ylabel("Concentration ratio (crime share ÷ population share)")
    ax.set_title("Crime Concentration by Distance to Nearest Metro Rail Station", color="white", fontsize=12, pad=10)
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3, axis="y")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5i_01_concentration_by_band.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5i_01_concentration_by_band.png")

    print("\n" + "=" * 60)
    print("  Phase 5I complete")
    for gkey, r in results.items():
        near = r["bands"][0]["concentration_ratio"]
        print(f"    {r['label']:<16} median_dist={r['median_dist_m']:.0f}m  0-250m ratio={near:.2f}x")
    print(f"  (population median distance to nearest station: {np.median(pop_dist):.0f}m)")
    print("=" * 60)


if __name__ == "__main__":
    main()
