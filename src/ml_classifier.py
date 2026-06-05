"""
Phase 5C -- Crime Classifier (XGBoost / Random Forest)
Two classification tasks:
  1. Binary  : predict is_violent (0/1)
  2. Multiclass: predict crime_category (18 classes)

Outputs (outputs/figures/):
  p5c_01_feature_importance.png    Top-20 features (binary + multiclass)
  p5c_02_confusion_matrix.png      Normalised confusion matrix (multiclass)
  p5c_03_roc_curve.png             ROC-AUC (binary)
  p5c_04_shap_summary.png          SHAP beeswarm (binary model)
  p5c_05_metrics_summary.png       Metrics dashboard

Outputs (outputs/models/):
  classifier_binary.joblib
  classifier_multiclass.joblib

Run: python src/ml_classifier.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.gridspec import GridSpec

ROOT    = Path(__file__).parent.parent
PROC    = ROOT / "data" / "processed"
FIGDIR  = ROOT / "outputs" / "figures"
MODDIR  = ROOT / "outputs" / "models"
FIGDIR.mkdir(parents=True, exist_ok=True)
MODDIR.mkdir(parents=True, exist_ok=True)

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
RED     = "#e05252"
GREEN   = "#3ecf8e"
ORANGE  = "#e0883a"
YELLOW  = "#e0c066"
MUTED   = "#7b82a0"
PURPLE  = "#7c5cbf"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": "white",
    "xtick.color": MUTED, "ytick.color": MUTED,
    "text.color": "white", "grid.color": "#2a2d3a",
    "grid.linestyle": "--", "grid.alpha": 0.5,
})

FEATURE_COLS = [
    # Temporal
    "hour", "day_of_week", "month", "quarter", "year", "is_weekend",
    # Geographic
    "AREA",
    # Weather
    "temp_avg_f", "is_hot_day", "is_rainy", "precip_in",
    # Economy
    "unemp_rate_pct",
    # Victim
    "vict_age",
    # Crime context
    "days_to_report",
]

SAMPLE_SIZE = 200_000   # subsample for speed — still statistically robust


def save(name: str):
    plt.savefig(FIGDIR / f"{name}.png", dpi=150,
                bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  Saved {name}.png")


# ── Data preparation ─────────────────────────────────────────────────────────

def load_and_prep() -> tuple[pd.DataFrame, pd.DataFrame]:
    print("Loading and preparing features...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet")

    # Convert booleans and categoricals to numeric
    bool_cols = ["is_hot_day", "is_rainy", "is_weekend"]
    for c in bool_cols:
        if c in df.columns:
            df[c] = df[c].fillna(False).astype(int)

    # Encode premises / weapon as ordinal
    prem_map = {"Residence/Home": 0, "Street/Sidewalk": 1, "Commercial": 2,
                "Vehicle": 3, "Other/Unknown": 4}
    weap_map = {"No Weapon": 0, "Personal Weapons": 1, "Bladed": 2,
                "Firearm": 3, "Other Weapon": 4}
    if "premises_group" in df.columns:
        df["premises_ord"] = df["premises_group"].map(prem_map).fillna(4).astype(int)
        FEATURE_COLS.append("premises_ord")
    if "weapon_category" in df.columns:
        df["weapon_ord"] = df["weapon_category"].map(weap_map).fillna(0).astype(int)
        FEATURE_COLS.append("weapon_ord")

    valid_cols = [c for c in FEATURE_COLS if c in df.columns]

    # Numeric coerce + fill
    for c in valid_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df[valid_cols] = df[valid_cols].fillna(df[valid_cols].median())

    df_clean = df[valid_cols + ["is_violent", "crime_category"]].dropna()
    print(f"  {len(df_clean):,} clean rows, {len(valid_cols)} features")

    # Subsample for speed
    if len(df_clean) > SAMPLE_SIZE:
        df_clean = df_clean.sample(SAMPLE_SIZE, random_state=42)
        print(f"  Subsampled to {SAMPLE_SIZE:,}")

    return df_clean, valid_cols


# ── Model training ────────────────────────────────────────────────────────────

def train_binary(df: pd.DataFrame, feat_cols: list) -> dict:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (accuracy_score, f1_score, roc_auc_score,
                                 classification_report, roc_curve)

    print("\nTraining binary classifier (is_violent)...")
    X = df[feat_cols].values
    y = df["is_violent"].astype(int).values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    try:
        from xgboost import XGBClassifier
        clf = XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.08,
            subsample=0.8, colsample_bytree=0.8,
            use_label_encoder=False, eval_metric="logloss",
            random_state=42, n_jobs=-1,
        )
        model_name = "XGBoost"
    except ImportError:
        from sklearn.ensemble import RandomForestClassifier
        clf = RandomForestClassifier(n_estimators=200, max_depth=12,
                                     n_jobs=-1, random_state=42)
        model_name = "RandomForest"

    clf.fit(X_tr, y_tr)
    y_pred  = clf.predict(X_te)
    y_proba = clf.predict_proba(X_te)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_te, y_pred) * 100, 2),
        "f1":       round(f1_score(y_te, y_pred, average="weighted") * 100, 2),
        "roc_auc":  round(roc_auc_score(y_te, y_proba) * 100, 2),
        "model":    model_name,
    }
    print(f"  {model_name} | Acc={metrics['accuracy']}%  F1={metrics['f1']}%  AUC={metrics['roc_auc']}%")

    fpr, tpr, _ = roc_curve(y_te, y_proba)

    importances = (clf.feature_importances_
                   if hasattr(clf, "feature_importances_")
                   else np.zeros(len(feat_cols)))

    return {
        "clf": clf, "metrics": metrics, "model_name": model_name,
        "fpr": fpr, "tpr": tpr,
        "importances": importances,
        "feat_cols": feat_cols,
        "X_te": X_te, "y_te": y_te, "y_proba": y_proba,
    }


def train_multiclass(df: pd.DataFrame, feat_cols: list) -> dict:
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import (accuracy_score, f1_score,
                                 confusion_matrix, classification_report)

    print("\nTraining multiclass classifier (crime_category)...")

    # Drop classes with fewer than 10 samples to allow stratified split
    df = df.copy()
    counts = df["crime_category"].value_counts()
    df = df[df["crime_category"].isin(counts[counts >= 10].index)]

    le = LabelEncoder()
    df["cat_enc"] = le.fit_transform(df["crime_category"].astype(str))

    X = df[feat_cols].values
    y = df["cat_enc"].values

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    try:
        from xgboost import XGBClassifier
        clf = XGBClassifier(
            n_estimators=300, max_depth=7, learning_rate=0.08,
            subsample=0.8, colsample_bytree=0.8,
            use_label_encoder=False, eval_metric="mlogloss",
            random_state=42, n_jobs=-1,
        )
        model_name = "XGBoost"
    except ImportError:
        from sklearn.ensemble import RandomForestClassifier
        clf = RandomForestClassifier(n_estimators=200, max_depth=14,
                                     n_jobs=-1, random_state=42)
        model_name = "RandomForest"

    clf.fit(X_tr, y_tr)
    y_pred = clf.predict(X_te)

    acc = accuracy_score(y_te, y_pred) * 100
    f1  = f1_score(y_te, y_pred, average="weighted") * 100
    cm  = confusion_matrix(y_te, y_pred, normalize="true")

    metrics = {
        "accuracy": round(acc, 2),
        "f1":       round(f1, 2),
        "model":    model_name,
    }
    print(f"  {model_name} | Acc={metrics['accuracy']}%  F1={metrics['f1']}%")

    importances = (clf.feature_importances_
                   if hasattr(clf, "feature_importances_")
                   else np.zeros(len(feat_cols)))

    return {
        "clf": clf, "metrics": metrics, "model_name": model_name,
        "importances": importances, "feat_cols": feat_cols,
        "cm": cm, "labels": le.classes_,
        "le": le,
    }


# ══════════════════════════════════════════════════════════════════════════════
# FIGURES
# ══════════════════════════════════════════════════════════════════════════════

FEAT_LABELS = {
    "hour":          "Hour of Day",
    "day_of_week":   "Day of Week",
    "month":         "Month",
    "quarter":       "Quarter",
    "year":          "Year",
    "is_weekend":    "Is Weekend",
    "AREA":          "LAPD Division",
    "temp_avg_f":    "Avg Temp (F)",
    "is_hot_day":    "Hot Day",
    "is_rainy":      "Rainy Day",
    "precip_in":     "Precipitation",
    "unemp_rate_pct":"Unemployment %",
    "vict_age":      "Victim Age",
    "days_to_report":"Days to Report",
    "premises_ord":  "Premises Type",
    "weapon_ord":    "Weapon Type",
}


def plot_feature_importance(bin_res: dict, multi_res: dict):
    fig, axes = plt.subplots(1, 2, figsize=(16, 7), facecolor=BG)

    for ax, res, title, color in [
        (axes[0], bin_res,   "Binary: Predict Violent Crime",   RED),
        (axes[1], multi_res, "Multiclass: Predict Category",    BLUE),
    ]:
        imp  = res["importances"]
        cols = res["feat_cols"]
        idx  = np.argsort(imp)[::-1][:15]
        labs = [FEAT_LABELS.get(cols[i], cols[i]) for i in idx]
        vals = imp[idx]
        vals_norm = vals / vals.max()

        ax.set_facecolor(SURFACE)
        bars = ax.barh(range(len(labs)), vals_norm[::-1],
                       color=color, alpha=0.85)
        ax.set_yticks(range(len(labs)))
        ax.set_yticklabels(labs[::-1], fontsize=10)
        ax.set_xlabel("Relative Importance", fontsize=10)
        ax.set_title(f"{title}\n{res['model_name']} | "
                     f"Acc={res['metrics']['accuracy']}%  "
                     f"F1={res['metrics']['f1']}%",
                     color="white", fontsize=11, pad=8)
        ax.grid(True, alpha=0.3, axis="x")

    fig.suptitle("Feature Importance — Crime Prediction Models",
                 fontsize=14, color="white")
    fig.tight_layout()
    save("p5c_01_feature_importance")


def plot_confusion_matrix(multi_res: dict):
    cm     = multi_res["cm"]
    labels = multi_res["labels"]

    fig, ax = plt.subplots(figsize=(13, 11), facecolor=BG)
    ax.set_facecolor(BG)

    cmap = plt.cm.Blues
    im   = ax.imshow(cm, interpolation="nearest", cmap=cmap,
                     vmin=0, vmax=1, aspect="auto")

    plt.colorbar(im, ax=ax, fraction=0.03, pad=0.02, label="Recall (normalised)")

    # Tick labels — truncate to 18 chars
    short = [l[:18] for l in labels]
    ax.set_xticks(range(len(short)))
    ax.set_yticks(range(len(short)))
    ax.set_xticklabels(short, rotation=45, ha="right", fontsize=8)
    ax.set_yticklabels(short, fontsize=8)

    # Cell values
    thresh = 0.4
    for i in range(len(labels)):
        for j in range(len(labels)):
            val = cm[i, j]
            if val > 0.05:
                ax.text(j, i, f"{val:.2f}", ha="center", va="center",
                        fontsize=7,
                        color="white" if val > thresh else MUTED)

    ax.set_xlabel("Predicted Category", fontsize=11)
    ax.set_ylabel("True Category", fontsize=11)
    ax.set_title(f"Confusion Matrix — {multi_res['model_name']} Multiclass Classifier\n"
                 f"Acc={multi_res['metrics']['accuracy']}%  F1={multi_res['metrics']['f1']}%  "
                 f"(normalised by row = recall)",
                 fontsize=12, color="white", pad=12)

    fig.tight_layout()
    save("p5c_02_confusion_matrix")


def plot_roc(bin_res: dict):
    fpr = bin_res["fpr"]
    tpr = bin_res["tpr"]
    auc = bin_res["metrics"]["roc_auc"]

    fig, ax = plt.subplots(figsize=(8, 7), facecolor=BG)
    ax.set_facecolor(SURFACE)

    ax.plot(fpr, tpr, color=BLUE, lw=2.5,
            label=f"ROC curve (AUC = {auc:.1f}%)")
    ax.plot([0, 1], [0, 1], color=MUTED, lw=1, ls="--",
            label="Random classifier (AUC = 50%)")
    ax.fill_between(fpr, tpr, alpha=0.1, color=BLUE)

    ax.set_xlabel("False Positive Rate (1 - Specificity)")
    ax.set_ylabel("True Positive Rate (Sensitivity)")
    ax.set_title(f"ROC Curve — Violent Crime Classifier\n{bin_res['model_name']}",
                 fontsize=13, color="white", pad=12)
    ax.legend(fontsize=10)
    ax.grid(True, alpha=0.3)

    # Highlight optimal threshold
    j_scores = tpr - fpr
    best_idx  = np.argmax(j_scores)
    ax.scatter(fpr[best_idx], tpr[best_idx], color=GREEN, s=100, zorder=6,
               label=f"Best threshold (J={j_scores[best_idx]:.3f})")
    ax.annotate(f"  Optimal\n  FPR={fpr[best_idx]:.2f}  TPR={tpr[best_idx]:.2f}",
                (fpr[best_idx], tpr[best_idx]),
                color=GREEN, fontsize=9)
    ax.legend(fontsize=9)

    fig.tight_layout()
    save("p5c_03_roc_curve")


def plot_shap(bin_res: dict):
    print("  Computing SHAP values (may take ~1 min)...")
    try:
        import shap
        X_te    = bin_res["X_te"][:2000]   # SHAP on 2000 samples
        feat    = bin_res["feat_cols"]
        clf     = bin_res["clf"]

        explainer = shap.TreeExplainer(clf)
        shap_vals = explainer.shap_values(X_te)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]   # positive class

        feat_labels = [FEAT_LABELS.get(f, f) for f in feat]

        fig, ax = plt.subplots(figsize=(10, 8), facecolor=BG)
        ax.set_facecolor(SURFACE)
        shap.summary_plot(shap_vals, X_te, feature_names=feat_labels,
                          plot_type="dot", show=False, color_bar=True,
                          plot_size=None, max_display=15)
        ax = plt.gca()
        ax.set_facecolor(SURFACE)
        ax.tick_params(colors=MUTED)
        plt.gcf().set_facecolor(BG)
        plt.title("SHAP Values — Violent Crime Binary Classifier",
                  color="white", fontsize=13, pad=10)
        plt.tight_layout()
        plt.savefig(FIGDIR / "p5c_04_shap_summary.png",
                    dpi=150, bbox_inches="tight", facecolor=BG)
        plt.close()
        print("  Saved p5c_04_shap_summary.png")
    except ImportError:
        print("  SHAP not installed. Plotting permutation importance instead...")
        _plot_permutation_importance(bin_res)


def _plot_permutation_importance(bin_res: dict):
    from sklearn.inspection import permutation_importance
    X_te = bin_res["X_te"][:3000]
    y_te = bin_res["y_te"][:3000]
    clf  = bin_res["clf"]
    feat = bin_res["feat_cols"]

    r    = permutation_importance(clf, X_te, y_te, n_repeats=5,
                                  random_state=42, n_jobs=-1)
    idx  = r.importances_mean.argsort()[::-1][:15]
    labs = [FEAT_LABELS.get(feat[i], feat[i]) for i in idx]

    fig, ax = plt.subplots(figsize=(10, 7), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.barh(range(len(labs)), r.importances_mean[idx][::-1] * 100,
            xerr=r.importances_std[idx][::-1] * 100,
            color=ORANGE, alpha=0.85, capsize=4)
    ax.set_yticks(range(len(labs)))
    ax.set_yticklabels(labs[::-1], fontsize=10)
    ax.set_xlabel("Mean accuracy decrease when feature is shuffled (%)")
    ax.set_title("Permutation Importance — Violent Crime Classifier",
                 color="white", fontsize=13, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    save("p5c_04_shap_summary")


def plot_metrics_summary(bin_res: dict, multi_res: dict):
    fig = plt.figure(figsize=(14, 6), facecolor=BG)
    gs  = GridSpec(1, 2, figure=fig, wspace=0.35)

    def panel(ax, metrics, title, color):
        ax.set_facecolor(SURFACE)
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_title(title, color="white", fontsize=13, pad=10)

        entries = [
            ("Model",    metrics["model"],        "white"),
            ("Accuracy", f"{metrics['accuracy']}%", color),
            ("F1-Score (weighted)", f"{metrics['f1']}%", color),
        ]
        if "roc_auc" in metrics:
            entries.append(("ROC-AUC", f"{metrics['roc_auc']}%", GREEN))

        for i, (label, val, col) in enumerate(entries):
            y_pos = 0.78 - i * 0.20
            ax.text(0.08, y_pos, label + ":", color=MUTED, fontsize=12)
            ax.text(0.55, y_pos, val, color=col,
                    fontsize=14 if i > 0 else 12, fontweight="bold")

    panel(fig.add_subplot(gs[0]),
          bin_res["metrics"],
          "Binary Classifier — Violent Crime (is_violent)",
          RED)
    panel(fig.add_subplot(gs[1]),
          multi_res["metrics"],
          "Multiclass Classifier — Crime Category (18 classes)",
          BLUE)

    fig.suptitle("ML Model Performance Summary", fontsize=16, color="white")
    fig.tight_layout()
    save("p5c_05_metrics_summary")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5C - Crime Classifier (XGBoost / RandomForest)")
    print("=" * 60 + "\n")

    import joblib

    df, feat_cols = load_and_prep()

    bin_res   = train_binary(df, feat_cols)
    multi_res = train_multiclass(df, feat_cols)

    print("\n[Saving models...]")
    joblib.dump(bin_res["clf"],   MODDIR / "classifier_binary.joblib")
    joblib.dump(multi_res["clf"], MODDIR / "classifier_multiclass.joblib")

    print("\n[Generating figures...]")
    plot_feature_importance(bin_res, multi_res)
    plot_confusion_matrix(multi_res)
    plot_roc(bin_res)
    plot_shap(bin_res)
    plot_metrics_summary(bin_res, multi_res)

    print("\n" + "=" * 60)
    print(f"  Phase 5C complete")
    print(f"  Binary    | {bin_res['model_name']} | Acc={bin_res['metrics']['accuracy']}%  "
          f"AUC={bin_res['metrics']['roc_auc']}%")
    print(f"  Multiclass| {multi_res['model_name']} | Acc={multi_res['metrics']['accuracy']}%  "
          f"F1={multi_res['metrics']['f1']}%")
    print("=" * 60)


if __name__ == "__main__":
    main()
