"""
Phase 5F -- Temporal Hotspot Model

ml_hotspot_predict.py (Phase 5E) predicts a single crime rate per tract for
the whole 2023-Q1/2024 window -- it answers "where" but not "when". It also
came back statistically tied with a naive persistence baseline (44.3% vs
44.7% hit rate @ top 20%), which raised the obvious question: is neighborhood
context genuinely uninformative, or is a single tract-level number just too
coarse for any feature to move the needle?

This phase tests that by giving the model (and the baselines) a temporal
axis: DAY_TYPE (weekday/weekend) x TIME_OF_DAY (4 six-hour blocks) = 8
"slots" per tract. Same reliable-data constraint as ml_hotspot_predict.py --
RELIABLE_CUTOFF stays inside the window where date_occ counts are complete.

Design:
  BASELINE period (2020-01 to 2022-12, 36mo): per-slot historical crime rate
    -- now the model has two competing naive baselines to beat, not one:
      1. tract-only persistence (Phase 5E's flat rate, ignoring time)
      2. tract x slot persistence (this phase's smarter naive: "this tract's
         own history for THIS slot specifically")
  TARGET period (2023-01 to RELIABLE_CUTOFF, 15mo): predicted per slot.
  Train/test: 80/20 split BY TRACT (all 8 slots of a tract stay together) --
    splitting by row would leak a tract's other-slot behavior into training
    for a held-out slot of the same tract, understating how hard this is.

Evaluation: hit rate (Predictive Accuracy Index) computed on ACTUAL CRIME
COUNTS (not rates) in the top-20%-by-predicted-rate slots -- ranking by rate
respects that weekday slots have ~2.5x more calendar instances than weekend
slots in any given window, so ranking by rate (not raw volume) is what a
real "which slot is riskiest per occurrence" deployment decision needs, while
summing counts for the hit-rate is what correctly measures "% of actual
crime captured."

Outputs (outputs/figures/): p5f_01_feature_importance.png, p5f_02_slot_heatmap.png
Outputs (outputs/reports/): hotspot_temporal_metrics.csv
Outputs (outputs/models/): hotspot_temporal_xgb.joblib
Outputs (dashboard/public/data/): hotspot_temporal_model.json, hotspot_temporal_tracts.geojson

Run: python src/ml_hotspot_temporal.py
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

TIME_BUCKETS = ["Late Night (00-05)", "Morning (06-11)", "Afternoon (12-17)", "Evening (18-23)"]
SLOT_KEY = {  # short, JSON/CSS-safe keys for the 8 (day_type, time_of_day) slots
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

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
GREEN   = "#3ecf8e"
YELLOW  = "#e0c066"
MUTED   = "#7b82a0"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": "white",
    "xtick.color": MUTED, "ytick.color": MUTED,
    "text.color": "white", "grid.color": "#2a2d3a",
    "grid.linestyle": "--", "grid.alpha": 0.5,
})

FEATURES = ["baseline_rate_slot", "baseline_rate_tract", "slot_share", "is_weekend",
            "time_of_day", "pop_total", "poverty_rate", "median_hh_income",
            "owner_occ_rate", "licenses_per_1000", "off_sale", "on_sale"]
CAT_FEATURES = ["time_of_day"]
FEAT_LABELS = {
    "baseline_rate_slot": "2020-22 Rate — This Slot", "baseline_rate_tract": "2020-22 Rate — Whole Tract",
    "slot_share": "Slot Share of Tract Total", "is_weekend": "Weekend",
    "time_of_day": "Time of Day", "pop_total": "Population",
    "poverty_rate": "Poverty Rate", "median_hh_income": "Median HH Income",
    "owner_occ_rate": "Homeownership Rate", "licenses_per_1000": "Alcohol Outlets/1k Pop",
    "off_sale": "Off-Sale Licenses", "on_sale": "On-Sale Licenses",
}


# ══════════════════════════════════════════════════════════════════════════════
# 1. DENOMINATORS — how many calendar instances of each slot fall in a window
# ══════════════════════════════════════════════════════════════════════════════

def slot_day_counts(start: pd.Timestamp, end: pd.Timestamp) -> dict:
    """{'weekday': n_weekdays, 'weekend': n_weekend_days} within [start, end]."""
    days = pd.date_range(start, end, freq="D")
    is_wknd = days.dayofweek.isin([5, 6])
    return {"weekend": int(is_wknd.sum()), "weekday": int((~is_wknd).sum())}


# ══════════════════════════════════════════════════════════════════════════════
# 2. BUILD TRACT x SLOT PANEL
# ══════════════════════════════════════════════════════════════════════════════

def build_slot_panel() -> pd.DataFrame:
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                          columns=["date_occ", "GEOID", "is_weekend", "time_of_day"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df = df.dropna(subset=["GEOID", "time_of_day"])
    df["day_type"] = np.where(df["is_weekend"], "weekend", "weekday")

    baseline = df[(df["date_occ"] >= BASELINE_START) & (df["date_occ"] <= BASELINE_END)]
    target   = df[(df["date_occ"] >= TARGET_START) & (df["date_occ"] <= RELIABLE_CUTOFF)]

    base_denom = slot_day_counts(BASELINE_START, BASELINE_END)
    targ_denom = slot_day_counts(TARGET_START, RELIABLE_CUTOFF)
    print(f"  Baseline denom (days): {base_denom}  Target denom (days): {targ_denom}")

    def slot_counts(frame):
        g = frame.groupby(["GEOID", "day_type", "time_of_day"]).size().rename("n")
        return g.reset_index()

    base_c = slot_counts(baseline).rename(columns={"n": "baseline_count"})
    targ_c = slot_counts(target).rename(columns={"n": "target_count"})

    # Full GEOID x slot grid so tracts silent in a given slot get a real zero, not a missing row
    geoids = sorted(set(df["GEOID"].dropna()))
    grid = pd.DataFrame(
        [(g, dt, tod) for g in geoids for dt, tod in SLOTS],
        columns=["GEOID", "day_type", "time_of_day"],
    )
    panel = grid.merge(base_c, on=["GEOID", "day_type", "time_of_day"], how="left") \
                .merge(targ_c, on=["GEOID", "day_type", "time_of_day"], how="left")
    panel[["baseline_count", "target_count"]] = panel[["baseline_count", "target_count"]].fillna(0)

    panel["baseline_rate_slot"] = panel.apply(
        lambda r: r["baseline_count"] / base_denom[r["day_type"]], axis=1)
    panel["target_rate_slot"] = panel.apply(
        lambda r: r["target_count"] / targ_denom[r["day_type"]], axis=1)

    tract_base = panel.groupby("GEOID")["baseline_count"].sum() / sum(base_denom.values())
    panel["baseline_rate_tract"] = panel["GEOID"].map(tract_base)

    # slot_share: this slot's rate vs. the tract's own average rate across the 4
    # time-of-day buckets WITHIN THE SAME day_type — >1 means this slot runs hotter
    # than the tract's typical weekday/weekend slot, <1 means quieter than typical.
    daytype_avg = panel.groupby(["GEOID", "day_type"])["baseline_rate_slot"].transform("mean")
    panel["slot_share"] = np.where(daytype_avg > 0, panel["baseline_rate_slot"] / daytype_avg, 0.0)
    panel["is_weekend"] = (panel["day_type"] == "weekend").astype(int)
    panel["slot_key"] = panel.apply(lambda r: SLOT_KEY[(r["day_type"], r["time_of_day"])], axis=1)

    print(f"  {len(panel):,} tract x slot rows ({len(geoids):,} tracts x {len(SLOTS)} slots)")

    print("Merging Census + alcohol context...")
    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[
        ["GEOID", "pop_total", "poverty_rate", "median_hh_income", "owner_occ_rate"]
    ]
    alcohol = gpd.read_file(DASH / "alcohol_density.geojson")[
        ["GEOID", "licenses_per_1000", "off_sale", "on_sale"]
    ]
    panel = panel.merge(tracts, on="GEOID", how="left").merge(alcohol, on="GEOID", how="left")
    panel = panel.dropna(subset=["pop_total"])
    print(f"  {len(panel):,} rows after Census join ({panel['GEOID'].nunique():,} tracts)")
    return panel


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

    tracts = panel["GEOID"].unique()
    test_tracts = set(RNG.choice(tracts, size=int(len(tracts) * 0.20), replace=False))
    is_test = panel["GEOID"].isin(test_tracts)

    X_train, X_test = X[~is_test], X[is_test]
    y_train, y_test = y[~is_test], y[is_test]
    n_tracts_train = panel.loc[~is_test, "GEOID"].nunique()
    n_tracts_test  = panel.loc[is_test, "GEOID"].nunique()
    print(f"\n  Train: {len(X_train)} rows ({n_tracts_train} tracts) | Test: {len(X_test)} rows ({n_tracts_test} tracts)")

    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
        enable_categorical=True,
    )
    model.fit(X_train, y_train)
    pred = np.clip(model.predict(X_test), 0, None)

    r2 = r2_score(y_test, pred)
    mae = mean_absolute_error(y_test, pred)

    test_df = panel.loc[is_test, ["GEOID", "slot_key", "baseline_rate_slot",
                                    "baseline_rate_tract", "target_rate_slot", "target_count"]].copy()
    test_df["predicted_rate"] = pred

    k = max(1, int(len(test_df) * TOP_K_PCT))
    total_actual = test_df["target_count"].sum()

    def hit_rate(rank_col):
        top_k = test_df.nlargest(k, rank_col)
        return top_k["target_count"].sum() / total_actual

    model_hit    = hit_rate("predicted_rate")
    slot_hit     = hit_rate("baseline_rate_slot")     # "smart" naive — this slot's own history
    tract_hit    = hit_rate("baseline_rate_tract")    # Phase 5E's naive — flat per tract, ignores time
    random_hit   = k / len(test_df)

    metrics = {
        "r2": round(r2, 4),
        "mae_monthly_crimes": round(mae, 3),
        "n_train": len(X_train), "n_test": len(X_test),
        "n_tracts_train": int(panel.loc[~is_test, "GEOID"].nunique()),
        "n_tracts_test": int(panel.loc[is_test, "GEOID"].nunique()),
        "top_k_pct": TOP_K_PCT,
        "model_hit_rate": round(model_hit, 4),
        "slot_persistence_hit_rate": round(slot_hit, 4),
        "tract_persistence_hit_rate": round(tract_hit, 4),
        "random_hit_rate": round(random_hit, 4),
    }
    print(f"  R²={metrics['r2']}  MAE={metrics['mae_monthly_crimes']} crimes/instance")
    print(f"  Hit rate @ top {TOP_K_PCT:.0%}: model={model_hit:.1%}  "
          f"slot-persistence={slot_hit:.1%}  tract-persistence(5E baseline)={tract_hit:.1%}  random={random_hit:.1%}")

    return model, metrics, test_df


# ══════════════════════════════════════════════════════════════════════════════
# 4. EXPORTS
# ══════════════════════════════════════════════════════════════════════════════

def export_map_geojson(model, panel: pd.DataFrame):
    """dashboard/public/data/hotspot_temporal_tracts.geojson — one row per
    tract, with pred_<slot>/hist_<slot> pairs for all 8 slots so the map
    layer can switch slots client-side without refetching."""
    X_all = panel[FEATURES].copy()
    for c in CAT_FEATURES:
        X_all[c] = X_all[c].astype(str).astype("category")
    for c in [f for f in FEATURES if f not in CAT_FEATURES]:
        X_all[c] = pd.to_numeric(X_all[c], errors="coerce")
    panel = panel.copy()
    panel["predicted_rate"] = np.clip(model.predict(X_all), 0, None)

    wide = panel.pivot_table(index="GEOID", columns="slot_key",
                              values=["predicted_rate", "baseline_rate_slot"], aggfunc="first")
    wide.columns = [f"{'pred' if a == 'predicted_rate' else 'hist'}_{b}" for a, b in wide.columns]
    wide = wide.round(3).reset_index()

    overall = panel.groupby("GEOID").agg(
        baseline_rate_tract=("baseline_rate_tract", "first"),
        pop_total=("pop_total", "first"),
        avg_predicted_rate=("predicted_rate", "mean"),
    ).reset_index()
    wide = wide.merge(overall, on="GEOID", how="left")

    def tier(series):
        q1, q2, q3 = series.quantile([0.5, 0.8, 0.95])
        return pd.cut(series, bins=[-1, q1, q2, q3, series.max() + 1],
                      labels=["Low", "Moderate", "High", "Very High"])
    wide["risk_tier"] = tier(wide["avg_predicted_rate"])

    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[["GEOID", "geometry"]]
    out_gdf = tracts.merge(wide, on="GEOID", how="inner")

    out = DASH / "hotspot_temporal_tracts.geojson"
    out_gdf.to_file(out, driver="GeoJSON")
    print(f"  Saved {len(out_gdf)} tracts x {len(SLOTS)} slots -> {out.relative_to(ROOT)}")


def export_dashboard_json(model, metrics: dict, panel: pd.DataFrame):
    imp = model.feature_importances_
    order = np.argsort(imp)[::-1]
    feature_importance = [
        {"feature": FEAT_LABELS.get(FEATURES[i], FEATURES[i]), "importance": round(float(imp[i] / imp[order[0]]), 4)}
        for i in order
    ]

    citywide = panel.groupby("slot_key").agg(
        baseline_rate_slot=("baseline_rate_slot", "sum"),
        target_count=("target_count", "sum"),
    ).reset_index()
    slot_summary = [
        {"slot": row.slot_key, "citywide_baseline_rate": round(float(row.baseline_rate_slot), 2),
         "citywide_target_count": int(row.target_count)}
        for row in citywide.itertuples()
    ]

    payload = {
        "baseline_period": f"{BASELINE_START.strftime('%Y-%m')} to {BASELINE_END.strftime('%Y-%m')}",
        "target_period": f"{TARGET_START.strftime('%Y-%m')} to {RELIABLE_CUTOFF.strftime('%Y-%m')}",
        "n_tracts": int(panel["GEOID"].nunique()),
        "n_slots": len(SLOTS),
        "metrics": metrics,
        "feature_importance": feature_importance,
        "hit_rate_comparison": [
            {"method": "Model (slot history + tract history + neighborhood context)", "hit_rate": metrics["model_hit_rate"]},
            {"method": "Slot persistence only (this tract, this time slot)", "hit_rate": metrics["slot_persistence_hit_rate"]},
            {"method": "Tract persistence only (Phase 5E baseline, ignores time)", "hit_rate": metrics["tract_persistence_hit_rate"]},
            {"method": "Random", "hit_rate": metrics["random_hit_rate"]},
        ],
        "slot_summary": slot_summary,
    }

    out = DASH / "hotspot_temporal_model.json"
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
    ax.barh(range(len(labs)), vals[::-1], color=BLUE, alpha=0.85)
    ax.set_yticks(range(len(labs))); ax.set_yticklabels(labs[::-1], fontsize=10)
    ax.set_xlabel("Relative Importance")
    ax.set_title(f"Feature Importance — Temporal Hotspot Prediction\nR²={metrics['r2']}  "
                 f"Hit Rate@{metrics['top_k_pct']:.0%}={metrics['model_hit_rate']:.1%}",
                 color="white", fontsize=12, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5f_01_feature_importance.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5f_01_feature_importance.png")


def plot_slot_heatmap(panel: pd.DataFrame):
    """Citywide baseline rate by day_type x time_of_day — the temporal
    pattern the flat Phase 5E model couldn't see at all."""
    pivot = panel.groupby(["day_type", "time_of_day"])["baseline_rate_slot"].sum().unstack("time_of_day")
    pivot = pivot.reindex(columns=TIME_BUCKETS).reindex(["weekday", "weekend"])

    fig, ax = plt.subplots(figsize=(9, 3.6), facecolor=BG)
    im = ax.imshow(pivot.values, cmap="inferno", aspect="auto")
    ax.set_xticks(range(len(TIME_BUCKETS))); ax.set_xticklabels(TIME_BUCKETS, fontsize=9)
    ax.set_yticks(range(2)); ax.set_yticklabels(["Weekday", "Weekend"], fontsize=10)
    for i in range(pivot.shape[0]):
        for j in range(pivot.shape[1]):
            ax.text(j, i, f"{pivot.values[i, j]:.0f}", ha="center", va="center",
                    color="white" if pivot.values[i, j] < pivot.values.max() * 0.6 else "black", fontsize=10)
    ax.set_title("Citywide Crimes/Day by Slot (2020-22 baseline)", color="white", fontsize=12, pad=10)
    fig.colorbar(im, ax=ax, shrink=0.8, label="crimes/day")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5f_02_slot_heatmap.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5f_02_slot_heatmap.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5F - Temporal Hotspot Model")
    print("=" * 60 + "\n")

    panel = build_slot_panel()
    model, metrics, test_df = train_and_evaluate(panel)

    pd.DataFrame([metrics]).to_csv(REPDIR / "hotspot_temporal_metrics.csv", index=False)
    print("\n  Saved hotspot_temporal_metrics.csv")

    print("\n[Generating figures...]")
    plot_feature_importance(model, metrics)
    plot_slot_heatmap(panel)

    joblib.dump(model, MODDIR / "hotspot_temporal_xgb.joblib")
    print("  Saved hotspot_temporal_xgb.joblib")

    print("\n[Exporting dashboard JSON + GeoJSON...]")
    export_dashboard_json(model, metrics, panel)
    export_map_geojson(model, panel)

    print("\n" + "=" * 60)
    lift_vs_slot  = metrics["model_hit_rate"] / metrics["slot_persistence_hit_rate"] - 1
    lift_vs_tract = metrics["model_hit_rate"] / metrics["tract_persistence_hit_rate"] - 1
    print(f"  Phase 5F complete — model hit rate {metrics['model_hit_rate']:.1%}")
    print(f"    vs slot-persistence  {metrics['slot_persistence_hit_rate']:.1%} ({'+' if lift_vs_slot>=0 else ''}{lift_vs_slot:.1%})")
    print(f"    vs tract-persistence {metrics['tract_persistence_hit_rate']:.1%} ({'+' if lift_vs_tract>=0 else ''}{lift_vs_tract:.1%})  <- Phase 5E's baseline")
    print("=" * 60)


if __name__ == "__main__":
    main()
