"""
Phase 5D -- Clearance Prediction

Binary classifier: will a reported crime be cleared (arrest OR exceptional
clearance -- LAPD Status in {AA, AO, JA, JO})? Answers the question behind
Insights Chapter 02 ("The Clearance Crisis") at the case level: what
actually predicts whether LAPD solves a case?

CRITICAL DATA ISSUE (same family of bug as src/ml_forecast.py):
  `cleared` is set once at whatever point the record was last updated in
  this extract -- but clearance takes time. A case from Dec 2024 has had
  almost no time to be investigated by the March-2025 snapshot date, so it
  reads as "not cleared" regardless of how solvable it actually was. The
  monthly clearance rate is a real, gradual decline from ~24% (2020) to
  ~18% (early 2024) -- then collapses to 2.5% by Dec 2024, which is NOT a
  real collapse in police performance, it's cases that haven't had time to
  mature. Training on unmatured cases would teach the model "recent =
  unsolved", a data-artifact than a real predictor.

  Fix: same RELIABLE_CUTOFF as ml_forecast.py (2024-03-31) -- every case
  in the training/eval set had at least ~12 months to mature before the
  snapshot. Monthly clearance rate for Jan-Mar 2024 (18.7/18.8/17.9%) is
  still continuous with the declining 2023 trend (18.5-21%), unlike
  Apr 2024 onward, which is why this cutoff (not an earlier one) is used.

Features: temporal, crime type/weapon/premises, victim demographics,
division, and neighborhood context from the 2026-07 enrichment pass --
Census tract poverty/income/homeownership (already in lapd_enriched.parquet
via the census join fix), ABC alcohol outlet density (per tract), and
streetlight density + land-use mix (per division).

Outputs (outputs/figures/): p5d_01_feature_importance.png, p5d_02_roc_curve.png,
  p5d_03_confusion_matrix.png, p5d_04_shap_summary.png
Outputs (outputs/reports/): clearance_metrics.csv
Outputs (outputs/models/): clearance_xgb.joblib

Run: python src/ml_clearance.py
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
from sklearn.metrics import (accuracy_score, f1_score, roc_auc_score, roc_curve,
                              confusion_matrix, precision_score, recall_score)

ROOT   = Path(__file__).parent.parent
PROC   = ROOT / "data" / "processed"
DASH   = ROOT / "dashboard" / "public" / "data"
FIGDIR = ROOT / "outputs" / "figures"
REPDIR = ROOT / "outputs" / "reports"
MODDIR = ROOT / "outputs" / "models"
for d in (FIGDIR, REPDIR, MODDIR):
    d.mkdir(parents=True, exist_ok=True)

RELIABLE_CUTOFF = pd.Timestamp("2024-03-31")  # see module docstring
TRAIN_END = pd.Timestamp("2022-12-31")         # temporal split: train <=2022, test 2023-01..cutoff

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
RED     = "#e05252"
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

CATEGORICAL = ["AREA NAME", "crime_category", "premises_group", "weapon_category",
               "age_group", "descent_group", "vict_sex", "time_of_day", "season"]
NUMERIC = ["hour", "day_of_week", "month", "is_weekend", "vict_age",
           "days_to_report", "mocode_count",
           "poverty_rate", "median_hh_income", "owner_occ_rate",
           "licenses_per_1000", "streetlights_per_1000_addr",
           "pct_residential", "pct_commercial"]
FEATURES = CATEGORICAL + NUMERIC

FEAT_LABELS = {
    "AREA NAME": "LAPD Division", "crime_category": "Crime Category",
    "premises_group": "Premises Type", "weapon_category": "Weapon Type",
    "age_group": "Victim Age Group", "descent_group": "Victim Ethnicity",
    "vict_sex": "Victim Sex", "time_of_day": "Time of Day", "season": "Season",
    "hour": "Hour", "day_of_week": "Day of Week", "month": "Month",
    "is_weekend": "Is Weekend", "vict_age": "Victim Age",
    "days_to_report": "Days to Report", "mocode_count": "# MO Codes",
    "poverty_rate": "Tract Poverty Rate", "median_hh_income": "Tract Median Income",
    "owner_occ_rate": "Tract Homeownership Rate", "licenses_per_1000": "Alcohol Outlets/1k Pop",
    "streetlights_per_1000_addr": "Streetlights/1k Addr",
    "pct_residential": "% Div. Residential Zoning", "pct_commercial": "% Div. Commercial Zoning",
}


# ══════════════════════════════════════════════════════════════════════════════
# 1. DATA LOADING + NEIGHBORHOOD ENRICHMENT
# ══════════════════════════════════════════════════════════════════════════════

def load_data() -> pd.DataFrame:
    print("Loading crime data...")
    cols = ["date_occ", "cleared", "AREA NAME", "crime_category", "premises_group",
            "weapon_category", "age_group", "descent_group", "vict_sex", "time_of_day",
            "season", "hour", "day_of_week", "month", "is_weekend", "vict_age",
            "days_to_report", "mocode_count", "GEOID",
            "poverty_rate", "median_hh_income", "owner_occ_rate"]
    df = pd.read_parquet(PROC / "lapd_enriched.parquet", columns=cols)
    df["date_occ"] = pd.to_datetime(df["date_occ"])

    n_total = len(df)
    df = df[df["date_occ"] <= RELIABLE_CUTOFF].copy()
    print(f"  {n_total:,} total rows | {len(df):,} within reliable window (<= {RELIABLE_CUTOFF.date()})")
    return df


def add_alcohol_density(df: pd.DataFrame) -> pd.DataFrame:
    alcohol = gpd.read_file(DASH / "alcohol_density.geojson")[["GEOID", "licenses_per_1000"]]
    alcohol["GEOID"] = alcohol["GEOID"].astype(str)
    df["GEOID"] = df["GEOID"].astype(str)
    return df.merge(alcohol, on="GEOID", how="left")


def add_division_context(df: pd.DataFrame) -> pd.DataFrame:
    sl = gpd.read_file(DASH / "streetlight_density.geojson")[["area name", "streetlights_per_1000_addr"]]
    zoning = pd.DataFrame(json.loads((DASH / "zoning_by_division.json").read_text(encoding="utf-8")))
    zoning["pct_residential"] = zoning[["Single Family Residential", "Multiple Family Residential",
                                         "Residential Multiple Family", "Residential-Mixed"]].sum(axis=1)
    zoning["pct_commercial"] = zoning[["Commercial", "Commercial-Mixed"]].sum(axis=1)
    zoning = zoning[["area name", "pct_residential", "pct_commercial"]]

    context = sl.merge(zoning, on="area name", how="left").rename(columns={"area name": "AREA NAME"})
    return df.merge(context, on="AREA NAME", how="left")


# ══════════════════════════════════════════════════════════════════════════════
# 2. MODEL
# ══════════════════════════════════════════════════════════════════════════════

def prep_features(df: pd.DataFrame) -> pd.DataFrame:
    X = df[FEATURES].copy()
    for c in CATEGORICAL:
        X[c] = X[c].astype(str).astype("category")
    for c in NUMERIC:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    return X


def train_and_evaluate(df: pd.DataFrame):
    train_df = df[df["date_occ"] <= TRAIN_END]
    test_df  = df[df["date_occ"] > TRAIN_END]
    print(f"\n  Train: {len(train_df):,} rows (<= {TRAIN_END.date()})")
    print(f"  Test:  {len(test_df):,} rows ({TRAIN_END.date()} to {RELIABLE_CUTOFF.date()})")

    X_train, y_train = prep_features(train_df), train_df["cleared"].astype(int)
    X_test, y_test = prep_features(test_df), test_df["cleared"].astype(int)

    clf = xgb.XGBClassifier(
        n_estimators=400, max_depth=6, learning_rate=0.06,
        subsample=0.8, colsample_bytree=0.8,
        eval_metric="logloss", enable_categorical=True,
        random_state=42, n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    y_proba = clf.predict_proba(X_test)[:, 1]
    y_pred = clf.predict(X_test)

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred) * 100, 2),
        "precision": round(precision_score(y_test, y_pred) * 100, 2),
        "recall": round(recall_score(y_test, y_pred) * 100, 2),
        "f1": round(f1_score(y_test, y_pred) * 100, 2),
        "roc_auc": round(roc_auc_score(y_test, y_proba) * 100, 2),
        "baseline_majority_class_acc": round(max(y_test.mean(), 1 - y_test.mean()) * 100, 2),
    }
    print(f"\n  Acc={metrics['accuracy']}%  Precision={metrics['precision']}%  Recall={metrics['recall']}%  "
          f"F1={metrics['f1']}%  AUC={metrics['roc_auc']}%  (baseline: {metrics['baseline_majority_class_acc']}%)")

    fpr, tpr, _ = roc_curve(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred, normalize="true")

    return {
        "clf": clf, "metrics": metrics, "fpr": fpr, "tpr": tpr, "cm": cm,
        "X_test": X_test, "y_test": y_test, "y_proba": y_proba,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 3. FIGURES
# ══════════════════════════════════════════════════════════════════════════════

def plot_feature_importance(res: dict):
    clf = res["clf"]
    imp = clf.feature_importances_
    idx = np.argsort(imp)[::-1][:15]
    labs = [FEAT_LABELS.get(FEATURES[i], FEATURES[i]) for i in idx]
    vals = imp[idx] / imp[idx].max()

    fig, ax = plt.subplots(figsize=(9, 7), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.barh(range(len(labs)), vals[::-1], color=BLUE, alpha=0.85)
    ax.set_yticks(range(len(labs))); ax.set_yticklabels(labs[::-1], fontsize=10)
    ax.set_xlabel("Relative Importance")
    ax.set_title(f"Feature Importance — Clearance Prediction\nXGBoost | Acc={res['metrics']['accuracy']}%  AUC={res['metrics']['roc_auc']}%",
                 color="white", fontsize=12, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5d_01_feature_importance.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5d_01_feature_importance.png")


def plot_roc(res: dict):
    fpr, tpr, auc = res["fpr"], res["tpr"], res["metrics"]["roc_auc"]
    fig, ax = plt.subplots(figsize=(7, 6.5), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.plot(fpr, tpr, color=GREEN, lw=2.5, label=f"XGBoost (AUC={auc:.1f}%)")
    ax.plot([0, 1], [0, 1], color=MUTED, lw=1, ls="--", label="Random (AUC=50%)")
    ax.fill_between(fpr, tpr, alpha=0.1, color=GREEN)
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve — Clearance Prediction", color="white", fontsize=13, pad=12)
    ax.legend(fontsize=10); ax.grid(True, alpha=0.3)
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5d_02_roc_curve.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5d_02_roc_curve.png")


def plot_confusion(res: dict):
    cm = res["cm"]
    fig, ax = plt.subplots(figsize=(5.5, 5), facecolor=BG)
    ax.set_facecolor(BG)
    im = ax.imshow(cm, cmap=plt.cm.Blues, vmin=0, vmax=1)
    plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    labels = ["Not Cleared", "Cleared"]
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(labels); ax.set_yticklabels(labels)
    for i in range(2):
        for j in range(2):
            ax.text(j, i, f"{cm[i,j]:.2f}", ha="center", va="center",
                    color="white" if cm[i, j] > 0.5 else MUTED, fontsize=13)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title("Confusion Matrix (row-normalized)", color="white", fontsize=12, pad=10)
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5d_03_confusion_matrix.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5d_03_confusion_matrix.png")


def plot_shap(res: dict):
    print("  Computing SHAP values...")
    import shap
    clf = res["clf"]
    X_sample = res["X_test"].sample(min(2000, len(res["X_test"])), random_state=42)
    explainer = shap.TreeExplainer(clf)
    shap_vals = explainer.shap_values(X_sample)

    labs = [FEAT_LABELS.get(c, c) for c in X_sample.columns]
    fig, ax = plt.subplots(figsize=(9, 8), facecolor=BG)
    ax.set_facecolor(SURFACE)
    shap.summary_plot(shap_vals, X_sample, feature_names=labs, show=False, max_display=15)
    plt.gcf().set_facecolor(BG)
    plt.gca().set_facecolor(SURFACE)
    plt.title("SHAP Values — Clearance Prediction", color="white", fontsize=13, pad=10)
    plt.tight_layout()
    plt.savefig(FIGDIR / "p5d_04_shap_summary.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5d_04_shap_summary.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5D - Clearance Prediction")
    print("=" * 60 + "\n")

    df = load_data()
    df = add_alcohol_density(df)
    df = add_division_context(df)

    for c in ["licenses_per_1000", "streetlights_per_1000_addr", "pct_residential", "pct_commercial"]:
        null_pct = df[c].isna().mean() * 100
        print(f"  {c}: {null_pct:.1f}% null")

    res = train_and_evaluate(df)

    pd.DataFrame([res["metrics"]]).to_csv(REPDIR / "clearance_metrics.csv", index=False)
    print("\n  Saved clearance_metrics.csv")

    print("\n[Generating figures...]")
    plot_feature_importance(res)
    plot_roc(res)
    plot_confusion(res)
    plot_shap(res)

    joblib.dump(res["clf"], MODDIR / "clearance_xgb.joblib")
    print("  Saved clearance_xgb.joblib")

    print("\n" + "=" * 60)
    print(f"  Phase 5D complete — AUC={res['metrics']['roc_auc']}%  "
          f"(baseline majority-class acc: {res['metrics']['baseline_majority_class_acc']}%)")
    print("=" * 60)


if __name__ == "__main__":
    main()
