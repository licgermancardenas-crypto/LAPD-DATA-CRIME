"""
Phase 5E -- Predictive Hotspot Model

The existing src/ml_hotspot.py (Phase 5A) is a KDE density map -- purely
descriptive, shows where crime already happened, no train/test, no
validation. This is a genuine predictive model: given a tract's crime
history through 2022 plus static neighborhood context (Census
poverty/income/homeownership, ABC alcohol outlet density), predict its
crime level in 2023-Q1/2024 and validate on tracts/periods the baseline
model doesn't just echo.

Same reliable-data constraint as ml_forecast.py / ml_clearance.py:
BASELINE_END / RELIABLE_CUTOFF stay inside the window where date_occ
counts are complete (see those modules' docstrings for why -- reporting
lag makes recent months look artificially quiet, not less dangerous).

Design:
  BASELINE period (2020-01 to 2022-12, 36mo): historical crime rate per
    tract -- crime's strongest predictor is usually where crime already
    concentrates, so this is the primary feature, not cheating.
  TARGET period (2023-01 to RELIABLE_CUTOFF, 15mo): what's predicted.
  Train/test: random 80/20 split across tracts (this is a cross-sectional
    problem -- ~1,241 tracts with any LAPD-jurisdiction crime -- not a
    time series, so a tract-level holdout is the right validation, not a
    temporal one).

Evaluation: R²/MAE on monthly crime rate, plus a hit-rate ("Predictive
Accuracy Index" -- standard hotspot-model metric in criminology): what
share of actual target-period crime falls inside the top 20% of tracts
by predicted risk, vs. the same top-20% picked by baseline-period rate
alone (does neighborhood context add anything beyond simple persistence?).

Outputs (outputs/figures/): p5e_01_feature_importance.png, p5e_02_predicted_vs_actual.png
Outputs (outputs/reports/): hotspot_metrics.csv, hotspot_tract_predictions.csv
Outputs (outputs/models/): hotspot_xgb.joblib

Run: python src/ml_hotspot_predict.py
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
from sklearn.model_selection import train_test_split
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
BASELINE_MONTHS = 36
TARGET_MONTHS = 15
TOP_K_PCT = 0.20

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

FEATURES = ["baseline_rate", "pop_total", "poverty_rate", "median_hh_income",
            "owner_occ_rate", "licenses_per_1000", "off_sale", "on_sale"]
FEAT_LABELS = {
    "baseline_rate": "2020-22 Crime Rate (baseline)", "pop_total": "Population",
    "poverty_rate": "Poverty Rate", "median_hh_income": "Median HH Income",
    "owner_occ_rate": "Homeownership Rate", "licenses_per_1000": "Alcohol Outlets/1k Pop",
    "off_sale": "Off-Sale Licenses", "on_sale": "On-Sale Licenses",
}


# ══════════════════════════════════════════════════════════════════════════════
# 1. BUILD TRACT-LEVEL PANEL
# ══════════════════════════════════════════════════════════════════════════════

def build_tract_panel() -> pd.DataFrame:
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet", columns=["date_occ", "GEOID"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df = df.dropna(subset=["GEOID"])

    baseline = df[(df["date_occ"] >= BASELINE_START) & (df["date_occ"] <= BASELINE_END)]
    target = df[(df["date_occ"] >= TARGET_START) & (df["date_occ"] <= RELIABLE_CUTOFF)]

    baseline_counts = (baseline.groupby("GEOID").size() / BASELINE_MONTHS).rename("baseline_rate")
    target_counts = (target.groupby("GEOID").size() / TARGET_MONTHS).rename("target_rate")

    panel = pd.concat([baseline_counts, target_counts], axis=1).fillna(0).reset_index()
    print(f"  {len(panel):,} tracts with any crime in baseline or target period")

    print("Merging Census + alcohol context...")
    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[
        ["GEOID", "pop_total", "poverty_rate", "median_hh_income", "owner_occ_rate"]
    ]
    alcohol = gpd.read_file(DASH / "alcohol_density.geojson")[
        ["GEOID", "licenses_per_1000", "off_sale", "on_sale"]
    ]
    panel = panel.merge(tracts, on="GEOID", how="left").merge(alcohol, on="GEOID", how="left")

    # Tracts with population but zero recorded crime are real (low-crime residential
    # areas) -- keep them. Tracts with no Census match at all are outside LA County
    # boundaries in this join and get dropped.
    panel = panel.dropna(subset=["pop_total"])
    print(f"  {len(panel):,} tracts after Census join")
    return panel


# ══════════════════════════════════════════════════════════════════════════════
# 2. MODEL
# ══════════════════════════════════════════════════════════════════════════════

def train_and_evaluate(panel: pd.DataFrame):
    X = panel[FEATURES].apply(pd.to_numeric, errors="coerce")
    y = panel["target_rate"]

    X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
        X, y, panel.index, test_size=0.20, random_state=42
    )
    print(f"\n  Train: {len(X_train)} tracts | Test: {len(X_test)} tracts")

    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    pred = np.clip(pred, 0, None)

    r2 = r2_score(y_test, pred)
    mae = mean_absolute_error(y_test, pred)

    test_df = panel.loc[idx_test, ["GEOID", "baseline_rate", "target_rate"]].copy()
    test_df["predicted_rate"] = pred

    k = max(1, int(len(test_df) * TOP_K_PCT))
    total_actual = test_df["target_rate"].sum()

    model_top_k = test_df.nlargest(k, "predicted_rate")
    model_hit_rate = model_top_k["target_rate"].sum() / total_actual

    baseline_top_k = test_df.nlargest(k, "baseline_rate")
    baseline_hit_rate = baseline_top_k["target_rate"].sum() / total_actual

    random_hit_rate = k / len(test_df)

    metrics = {
        "r2": round(r2, 4),
        "mae_monthly_crimes": round(mae, 2),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "top_k_pct": TOP_K_PCT,
        "model_hit_rate": round(model_hit_rate, 4),
        "baseline_persistence_hit_rate": round(baseline_hit_rate, 4),
        "random_hit_rate": round(random_hit_rate, 4),
    }
    print(f"  R²={metrics['r2']}  MAE={metrics['mae_monthly_crimes']} crimes/mo")
    print(f"  Hit rate @ top {TOP_K_PCT:.0%}: model={model_hit_rate:.1%}  "
          f"baseline-persistence={baseline_hit_rate:.1%}  random={random_hit_rate:.1%}")

    return model, metrics, test_df


def export_dashboard_json(model, metrics: dict, panel: pd.DataFrame):
    """dashboard/public/data/hotspot_model.json"""
    imp = model.feature_importances_
    order = np.argsort(imp)[::-1]
    feature_importance = [
        {"feature": FEAT_LABELS.get(FEATURES[i], FEATURES[i]), "importance": round(float(imp[i] / imp[order[0]]), 4)}
        for i in order
    ]

    payload = {
        "baseline_period": f"{BASELINE_START.strftime('%Y-%m')} to {BASELINE_END.strftime('%Y-%m')}",
        "target_period": f"{TARGET_START.strftime('%Y-%m')} to {RELIABLE_CUTOFF.strftime('%Y-%m')}",
        "n_tracts": len(panel),
        "metrics": metrics,
        "feature_importance": feature_importance,
        "hit_rate_comparison": [
            {"method": "Model (baseline + neighborhood context)", "hit_rate": metrics["model_hit_rate"]},
            {"method": "Baseline persistence only", "hit_rate": metrics["baseline_persistence_hit_rate"]},
            {"method": "Random", "hit_rate": metrics["random_hit_rate"]},
        ],
    }

    out = ROOT / "dashboard" / "public" / "data" / "hotspot_model.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"  Saved {out.relative_to(ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# 3. FIGURES
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
    ax.set_title(f"Feature Importance — Hotspot Prediction\nR²={metrics['r2']}  "
                 f"Hit Rate@{metrics['top_k_pct']:.0%}={metrics['model_hit_rate']:.1%}",
                 color="white", fontsize=12, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5e_01_feature_importance.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5e_01_feature_importance.png")


def plot_predicted_vs_actual(test_df: pd.DataFrame, metrics: dict):
    fig, ax = plt.subplots(figsize=(7, 7), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.scatter(test_df["target_rate"], test_df["predicted_rate"],
               c=BLUE, alpha=0.5, s=25, edgecolors="none")
    lim = max(test_df["target_rate"].max(), test_df["predicted_rate"].max()) * 1.05
    ax.plot([0, lim], [0, lim], color=MUTED, lw=1, ls="--", label="Perfect prediction")
    ax.set_xlim(0, lim); ax.set_ylim(0, lim)
    ax.set_xlabel("Actual crimes/month (2023 – Q1 2024)")
    ax.set_ylabel("Predicted crimes/month")
    ax.set_title(f"Predicted vs Actual Crime Rate per Tract\nR²={metrics['r2']}  MAE={metrics['mae_monthly_crimes']} crimes/mo",
                 color="white", fontsize=12, pad=10)
    ax.legend(fontsize=9); ax.grid(True, alpha=0.3)
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5e_02_predicted_vs_actual.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5e_02_predicted_vs_actual.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5E - Predictive Hotspot Model")
    print("=" * 60 + "\n")

    panel = build_tract_panel()
    model, metrics, test_df = train_and_evaluate(panel)

    pd.DataFrame([metrics]).to_csv(REPDIR / "hotspot_metrics.csv", index=False)
    test_df.to_csv(REPDIR / "hotspot_tract_predictions.csv", index=False)
    print("\n  Saved hotspot_metrics.csv, hotspot_tract_predictions.csv")

    print("\n[Generating figures...]")
    plot_feature_importance(model, metrics)
    plot_predicted_vs_actual(test_df, metrics)

    joblib.dump(model, MODDIR / "hotspot_xgb.joblib")
    print("  Saved hotspot_xgb.joblib")

    print("\n[Exporting dashboard JSON...]")
    export_dashboard_json(model, metrics, panel)

    print("\n" + "=" * 60)
    lift = metrics["model_hit_rate"] / metrics["baseline_persistence_hit_rate"] - 1
    print(f"  Phase 5E complete — model hit rate {metrics['model_hit_rate']:.1%} vs "
          f"persistence-only {metrics['baseline_persistence_hit_rate']:.1%} "
          f"({'+' if lift>=0 else ''}{lift:.1%} lift)")
    print("=" * 60)


if __name__ == "__main__":
    main()
