"""
Phase 5H -- Neighborhood-Level Temporal Hotspot Model

Phases 5F/5G ran the tract x time-slot design at Census tract granularity
(1,241 units) -- the finest geography available, but also a classic setup
for the Modifiable Areal Unit Problem (MAUP): a tract this small, split
into 8 time slots, produces a target so sparse for most tracts that there
may be nothing left for neighborhood context to explain beyond noise.
This phase re-runs the same design at LA Times Neighborhood Council
granularity (114 named neighborhoods, ~11 tracts each) to test whether a
coarser, less sparse target lets Census/alcohol context actually show up.

Trade-off going in, stated plainly: 114 units is a real drop in spatial
precision from 1,241 tracts -- a neighborhood-level hotspot map can't
point to a specific block the way the tract map can. This phase is about
whether that trade buys back real predictive signal, not about replacing
the tract-level map.

Incidents are point-in-polygon joined directly into the 114 neighborhood
boundaries (not area-weighted from tract aggregates like
scripts/generate_neighborhood_data.py) -- slot-level counts need each
incident assigned to exactly one neighborhood, which an area-weighted
allocation can't give cleanly. Neighborhood-level Census/alcohol context
IS area-weighted from tract data (population-weighted average), same
denominator logic as that script, since those are legitimately continuous
neighborhood-level quantities.

Same reliable-data constraint, same BASELINE/TARGET windows, same
tract x slot -> now neighborhood x slot panel and hit-rate methodology
as ml_hotspot_temporal.py, run on "All Crime" (not split by type -- that's
Phase 5G's axis, this phase isolates the granularity question alone).

Outputs (outputs/figures/): p5h_01_feature_importance.png, p5h_02_granularity_comparison.png
Outputs (outputs/reports/): hotspot_neighborhood_metrics.csv
Outputs (outputs/models/): hotspot_neighborhood_xgb.joblib
Outputs (dashboard/public/data/): hotspot_neighborhood_model.json, hotspot_neighborhood_areas.geojson

Run: python src/ml_hotspot_neighborhood.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import geopandas as gpd
import joblib
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import xgboost as xgb
from sklearn.metrics import r2_score, mean_absolute_error

ROOT   = Path(__file__).parent.parent
PROC   = ROOT / "data" / "processed"
EXT    = ROOT / "data" / "external"
DASH   = ROOT / "dashboard" / "public" / "data"
FIGDIR = ROOT / "outputs" / "figures"
REPDIR = ROOT / "outputs" / "reports"
MODDIR = ROOT / "outputs" / "models"
for d in (FIGDIR, REPDIR, MODDIR):
    d.mkdir(parents=True, exist_ok=True)

RELIABLE_CUTOFF = pd.Timestamp("2024-03-31")
BASELINE_START, BASELINE_END = pd.Timestamp("2020-01-01"), pd.Timestamp("2022-12-31")
TARGET_START = pd.Timestamp("2023-01-01")
TOP_K_PCT = 0.20
RNG = np.random.default_rng(42)
TEST_FRACTION = 0.20

SLOT_KEY = {
    ("weekday", "Late Night (00-05)"):  "weekday_latenight",
    ("weekday", "Morning (06-11)"):     "weekday_morning",
    ("weekday", "Afternoon (12-17)"):   "weekday_afternoon",
    ("weekday", "Evening (18-23)"):     "weekday_evening",
    ("weekend", "Late Night (00-05)"):  "weekend_latenight",
    ("weekend", "Morning (06-11)"):     "weekend_morning",
    ("weekend", "Afternoon (12-17)"):   "weekend_afternoon",
    ("weekend", "Evening (18-23)"):     "weekend_evening",
}
SLOTS = list(SLOT_KEY.keys())

BG = "#0f1117"; SURFACE = "#1a1d27"; BLUE = "#4f8ef7"; GREEN = "#3ecf8e"
YELLOW = "#e0c066"; MUTED = "#7b82a0"; PURPLE = "#a78bfa"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": "white",
    "xtick.color": MUTED, "ytick.color": MUTED,
    "text.color": "white", "grid.color": "#2a2d3a",
    "grid.linestyle": "--", "grid.alpha": 0.5,
})

FEATURES = ["baseline_rate_slot", "baseline_rate_area", "slot_share", "is_weekend",
            "time_of_day", "pop_total", "poverty_rate", "median_hh_income",
            "owner_occ_rate", "licenses_per_1000", "off_sale", "on_sale"]
CAT_FEATURES = ["time_of_day"]
FEAT_LABELS = {
    "baseline_rate_slot": "2020-22 Rate — This Slot", "baseline_rate_area": "2020-22 Rate — Whole Neighborhood",
    "slot_share": "Slot Share of Area Total", "is_weekend": "Weekend",
    "time_of_day": "Time of Day", "pop_total": "Population",
    "poverty_rate": "Poverty Rate", "median_hh_income": "Median HH Income",
    "owner_occ_rate": "Homeownership Rate", "licenses_per_1000": "Alcohol Outlets/1k Pop",
    "off_sale": "Off-Sale Licenses", "on_sale": "On-Sale Licenses",
}


# ══════════════════════════════════════════════════════════════════════════════
# 1. SPATIAL JOINS
# ══════════════════════════════════════════════════════════════════════════════

def slot_day_counts(start: pd.Timestamp, end: pd.Timestamp) -> dict:
    days = pd.date_range(start, end, freq="D")
    is_wknd = days.dayofweek.isin([5, 6])
    return {"weekend": int(is_wknd.sum()), "weekday": int((~is_wknd).sum())}


def join_incidents_to_neighborhoods(nb: gpd.GeoDataFrame) -> pd.DataFrame:
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                          columns=["date_occ", "LAT", "LON", "valid_geo", "is_weekend", "time_of_day"])
    df = df[df["valid_geo"] & (df["LAT"] != 0) & (df["LON"] != 0)].copy()
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df["day_type"] = np.where(df["is_weekend"], "weekend", "weekday")

    print(f"  Spatial join: {len(df):,} incidents -> {len(nb)} neighborhoods...")
    pts = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df["LON"], df["LAT"]), crs="EPSG:4326"
    )
    joined = gpd.sjoin(pts, nb[["name", "geometry"]], how="inner", predicate="within")
    matched = len(joined) / len(df)
    print(f"  {len(joined):,} incidents matched to a neighborhood ({matched:.1%})")
    return pd.DataFrame(joined.drop(columns="geometry"))


def build_neighborhood_context(nb: gpd.GeoDataFrame) -> pd.DataFrame:
    """Population-weighted roll-up of tract-level Census/alcohol context to
    neighborhoods, via tract-centroid-in-neighborhood assignment (tracts are
    ~11x smaller than neighborhoods on average, so centroid assignment is a
    reasonable approximation -- full area-weighting is overkill for context
    features that only need to be directionally right, unlike the incident
    counts above which need to be exactly right)."""
    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[
        ["GEOID", "pop_total", "poverty_rate", "median_hh_income", "owner_occ_rate", "geometry"]
    ]
    alcohol = gpd.read_file(DASH / "alcohol_density.geojson")[
        ["GEOID", "licenses_per_1000", "off_sale", "on_sale"]
    ]
    tracts = tracts.merge(alcohol, on="GEOID", how="left")

    centroids = tracts.copy()
    centroids["geometry"] = tracts.geometry.centroid
    joined = gpd.sjoin(centroids, nb[["name", "geometry"]], how="inner", predicate="within")
    joined = pd.DataFrame(joined.drop(columns="geometry"))
    for c in ["pop_total", "poverty_rate", "median_hh_income", "owner_occ_rate",
              "licenses_per_1000", "off_sale", "on_sale"]:
        joined[c] = pd.to_numeric(joined[c], errors="coerce")

    w = joined["pop_total"].fillna(0)
    joined["w"] = w
    agg = joined.groupby("name").apply(lambda g: pd.Series({
        "pop_total": g["pop_total"].sum(),
        "poverty_rate": np.average(g["poverty_rate"].fillna(0), weights=g["w"].replace(0, 1)),
        "median_hh_income": np.average(g["median_hh_income"].fillna(0), weights=g["w"].replace(0, 1)),
        "owner_occ_rate": np.average(g["owner_occ_rate"].fillna(0), weights=g["w"].replace(0, 1)),
        "licenses_per_1000": np.average(g["licenses_per_1000"].fillna(0), weights=g["w"].replace(0, 1)),
        "off_sale": g["off_sale"].fillna(0).sum(),
        "on_sale": g["on_sale"].fillna(0).sum(),
    })).reset_index()
    return agg


# ══════════════════════════════════════════════════════════════════════════════
# 2. BUILD NEIGHBORHOOD x SLOT PANEL
# ══════════════════════════════════════════════════════════════════════════════

def build_panel() -> tuple:
    nb = gpd.read_file(EXT / "LA_Times_Neighborhood_Boundaries.geojson")[["name", "geometry"]]
    if nb.crs is None or nb.crs.to_epsg() != 4326:
        nb = nb.to_crs(4326)
    names = sorted(nb["name"].dropna().unique())

    joined = join_incidents_to_neighborhoods(nb)
    base_denom = slot_day_counts(BASELINE_START, BASELINE_END)
    targ_denom = slot_day_counts(TARGET_START, RELIABLE_CUTOFF)

    baseline = joined[(joined["date_occ"] >= BASELINE_START) & (joined["date_occ"] <= BASELINE_END)]
    target   = joined[(joined["date_occ"] >= TARGET_START) & (joined["date_occ"] <= RELIABLE_CUTOFF)]

    def slot_counts(frame):
        return frame.groupby(["name", "day_type", "time_of_day"]).size().rename("n").reset_index()

    base_c = slot_counts(baseline).rename(columns={"n": "baseline_count"})
    targ_c = slot_counts(target).rename(columns={"n": "target_count"})

    grid = pd.DataFrame(
        [(n, dt, tod) for n in names for dt, tod in SLOTS],
        columns=["name", "day_type", "time_of_day"],
    )
    panel = grid.merge(base_c, on=["name", "day_type", "time_of_day"], how="left") \
                .merge(targ_c, on=["name", "day_type", "time_of_day"], how="left")
    panel[["baseline_count", "target_count"]] = panel[["baseline_count", "target_count"]].fillna(0)

    panel["baseline_rate_slot"] = panel.apply(lambda r: r["baseline_count"] / base_denom[r["day_type"]], axis=1)
    panel["target_rate_slot"] = panel.apply(lambda r: r["target_count"] / targ_denom[r["day_type"]], axis=1)

    area_base = panel.groupby("name")["baseline_count"].sum() / sum(base_denom.values())
    panel["baseline_rate_area"] = panel["name"].map(area_base)

    daytype_avg = panel.groupby(["name", "day_type"])["baseline_rate_slot"].transform("mean")
    panel["slot_share"] = np.where(daytype_avg > 0, panel["baseline_rate_slot"] / daytype_avg, 0.0)
    panel["is_weekend"] = (panel["day_type"] == "weekend").astype(int)
    panel["slot_key"] = panel.apply(lambda r: SLOT_KEY[(r["day_type"], r["time_of_day"])], axis=1)

    print("Building neighborhood-level Census/alcohol context...")
    context = build_neighborhood_context(nb)
    panel = panel.merge(context, on="name", how="left")
    panel = panel.dropna(subset=["pop_total"])
    print(f"  {len(panel):,} neighborhood x slot rows ({panel['name'].nunique()} neighborhoods x {len(SLOTS)} slots)")

    zero_frac = (panel["baseline_count"] == 0).mean()
    print(f"  Zero-baseline cells: {zero_frac:.1%} (compare to Phase 5F's tract-level sparsity)")
    return panel, nb


# ══════════════════════════════════════════════════════════════════════════════
# 3. MODEL
# ══════════════════════════════════════════════════════════════════════════════

def train_and_evaluate(panel: pd.DataFrame):
    X = panel[FEATURES].copy()
    for c in CAT_FEATURES:
        X[c] = X[c].astype(str).astype("category")
    for c in [f for f in FEATURES if f not in CAT_FEATURES]:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    y = panel["target_rate_slot"]

    names = panel["name"].unique()
    test_names = set(RNG.choice(names, size=max(1, int(len(names) * TEST_FRACTION)), replace=False))
    is_test = panel["name"].isin(test_names)

    X_train, X_test = X[~is_test], X[is_test]
    y_train, y_test = y[~is_test], y[is_test]
    print(f"\n  Train: {len(X_train)} rows ({panel.loc[~is_test,'name'].nunique()} neighborhoods) | "
          f"Test: {len(X_test)} rows ({panel.loc[is_test,'name'].nunique()} neighborhoods)")

    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
        enable_categorical=True,
    )
    model.fit(X_train, y_train)
    pred = np.clip(model.predict(X_test), 0, None)

    r2 = r2_score(y_test, pred)
    mae = mean_absolute_error(y_test, pred)

    test_df = panel.loc[is_test, ["name", "slot_key", "baseline_rate_slot",
                                    "baseline_rate_area", "target_rate_slot", "target_count"]].copy()
    test_df["predicted_rate"] = pred

    k = max(1, int(len(test_df) * TOP_K_PCT))
    total_actual = test_df["target_count"].sum()

    def hit_rate(rank_col):
        if total_actual <= 0:
            return 0.0
        return test_df.nlargest(k, rank_col)["target_count"].sum() / total_actual

    metrics = {
        "granularity": "neighborhood", "n_areas": int(panel["name"].nunique()),
        "r2": round(r2, 4), "mae": round(mae, 4),
        "n_train": len(X_train), "n_test": len(X_test),
        "top_k_pct": TOP_K_PCT,
        "model_hit_rate": round(hit_rate("predicted_rate"), 4),
        "slot_persistence_hit_rate": round(hit_rate("baseline_rate_slot"), 4),
        "area_persistence_hit_rate": round(hit_rate("baseline_rate_area"), 4),
        "random_hit_rate": round(k / len(test_df), 4),
    }
    print(f"  R²={metrics['r2']}  MAE={metrics['mae']} crimes/instance")
    print(f"  Hit@{TOP_K_PCT:.0%}: model={metrics['model_hit_rate']:.1%}  "
          f"slot={metrics['slot_persistence_hit_rate']:.1%}  area={metrics['area_persistence_hit_rate']:.1%}  "
          f"random={metrics['random_hit_rate']:.1%}")

    return model, metrics


# ══════════════════════════════════════════════════════════════════════════════
# 4. EXPORTS
# ══════════════════════════════════════════════════════════════════════════════

def export_map_geojson(model, panel: pd.DataFrame, nb: gpd.GeoDataFrame):
    X_all = panel[FEATURES].copy()
    for c in CAT_FEATURES:
        X_all[c] = X_all[c].astype(str).astype("category")
    for c in [f for f in FEATURES if f not in CAT_FEATURES]:
        X_all[c] = pd.to_numeric(X_all[c], errors="coerce")
    panel = panel.copy()
    panel["predicted_rate"] = np.clip(model.predict(X_all), 0, None)

    wide = panel.pivot_table(index="name", columns="slot_key",
                              values=["predicted_rate", "baseline_rate_slot"], aggfunc="first")
    wide.columns = [f"{'pred' if a == 'predicted_rate' else 'hist'}_{b}" for a, b in wide.columns]
    wide = wide.round(3).reset_index()

    overall = panel.groupby("name").agg(pop_total=("pop_total", "first")).reset_index()
    wide = wide.merge(overall, on="name", how="left")

    out_gdf = nb.merge(wide, on="name", how="inner")
    out = DASH / "hotspot_neighborhood_areas.geojson"
    out_gdf.to_file(out, driver="GeoJSON")
    print(f"  Saved {len(out_gdf)} neighborhoods x {len(SLOTS)} slots -> {out.relative_to(ROOT)}")


def export_dashboard_json(model, metrics: dict):
    imp = model.feature_importances_
    order = np.argsort(imp)[::-1]
    feature_importance = [
        {"feature": FEAT_LABELS.get(FEATURES[i], FEATURES[i]), "importance": round(float(imp[i] / imp[order[0]]), 4)}
        for i in order
    ]
    payload = {
        "baseline_period": f"{BASELINE_START.strftime('%Y-%m')} to {BASELINE_END.strftime('%Y-%m')}",
        "target_period": f"{TARGET_START.strftime('%Y-%m')} to {RELIABLE_CUTOFF.strftime('%Y-%m')}",
        "metrics": metrics,
        "feature_importance": feature_importance,
    }
    out = DASH / "hotspot_neighborhood_model.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"  Saved {out.relative_to(ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. FIGURES
# ══════════════════════════════════════════════════════════════════════════════

def plot_feature_importance(model, metrics):
    imp = model.feature_importances_
    idx = np.argsort(imp)[::-1]
    labs = [FEAT_LABELS.get(FEATURES[i], FEATURES[i]) for i in idx]
    vals = imp[idx] / imp[idx].max()

    fig, ax = plt.subplots(figsize=(9, 6), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.barh(range(len(labs)), vals[::-1], color=PURPLE, alpha=0.85)
    ax.set_yticks(range(len(labs))); ax.set_yticklabels(labs[::-1], fontsize=10)
    ax.set_xlabel("Relative Importance")
    ax.set_title(f"Feature Importance — Neighborhood-Level Hotspot\nHit Rate@{metrics['top_k_pct']:.0%}={metrics['model_hit_rate']:.1%}",
                 color="white", fontsize=12, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5h_01_feature_importance.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5h_01_feature_importance.png")


def plot_granularity_comparison(metrics: dict, tract_metrics: dict | None):
    if tract_metrics is None:
        print("  Skipped p5h_02_granularity_comparison.png (Phase 5F metrics CSV not found)")
        return
    rows = [
        ("Tract\n(1,241 units)", tract_metrics["tract_persistence_hit_rate"], tract_metrics["slot_persistence_hit_rate"], tract_metrics["model_hit_rate"]),
        ("Neighborhood\n(114 units)", metrics["area_persistence_hit_rate"], metrics["slot_persistence_hit_rate"], metrics["model_hit_rate"]),
    ]
    labels = [r[0] for r in rows]
    flat = [r[1] * 100 for r in rows]
    slot = [r[2] * 100 for r in rows]
    model = [r[3] * 100 for r in rows]

    fig, ax = plt.subplots(figsize=(8, 5), facecolor=BG)
    ax.set_facecolor(SURFACE)
    x = np.arange(len(labels)); width = 0.25
    ax.bar(x - width, flat, width, label="Flat area (no time)", color=MUTED)
    ax.bar(x, slot, width, label="Slot history (time, no model)", color=GREEN)
    b = ax.bar(x + width, model, width, label="Model (full)", color=BLUE)
    ax.bar_label(b, fmt="%.1f%%", fontsize=9, color="white", padding=2)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=11)
    ax.set_ylabel("Hit Rate @ Top 20%")
    ax.set_title("Does Geography Granularity Change the Answer?", color="white", fontsize=12, pad=10)
    ax.legend(fontsize=9)
    ax.grid(True, alpha=0.3, axis="y")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5h_02_granularity_comparison.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5h_02_granularity_comparison.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5H - Neighborhood-Level Temporal Hotspot Model")
    print("=" * 60 + "\n")

    panel, nb = build_panel()
    model, metrics = train_and_evaluate(panel)

    pd.DataFrame([metrics]).to_csv(REPDIR / "hotspot_neighborhood_metrics.csv", index=False)
    print("\n  Saved hotspot_neighborhood_metrics.csv")

    tract_metrics = None
    tract_csv = REPDIR / "hotspot_temporal_metrics.csv"
    if tract_csv.exists():
        tract_metrics = pd.read_csv(tract_csv).iloc[0].to_dict()

    print("\n[Generating figures...]")
    plot_feature_importance(model, metrics)
    plot_granularity_comparison(metrics, tract_metrics)

    joblib.dump(model, MODDIR / "hotspot_neighborhood_xgb.joblib")
    print("  Saved hotspot_neighborhood_xgb.joblib")

    print("\n[Exporting dashboard JSON + GeoJSON...]")
    export_dashboard_json(model, metrics)
    export_map_geojson(model, panel, nb)

    print("\n" + "=" * 60)
    lift_slot = metrics["model_hit_rate"] / metrics["slot_persistence_hit_rate"] - 1 if metrics["slot_persistence_hit_rate"] else 0
    lift_area = metrics["model_hit_rate"] / metrics["area_persistence_hit_rate"] - 1 if metrics["area_persistence_hit_rate"] else 0
    print(f"  Phase 5H complete — model hit rate {metrics['model_hit_rate']:.1%}")
    print(f"    vs slot-persistence {metrics['slot_persistence_hit_rate']:.1%} ({'+' if lift_slot>=0 else ''}{lift_slot:.1%})")
    print(f"    vs flat-area        {metrics['area_persistence_hit_rate']:.1%} ({'+' if lift_area>=0 else ''}{lift_area:.1%})")
    if tract_metrics:
        print(f"  (Phase 5F tract-level model was {tract_metrics['model_hit_rate']:.1%} vs slot {tract_metrics['slot_persistence_hit_rate']:.1%})")
    print("=" * 60)


if __name__ == "__main__":
    main()
