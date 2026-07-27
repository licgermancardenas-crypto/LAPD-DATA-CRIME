"""
Phase 5G -- Crime-Type x Temporal Hotspot Model

Phase 5F found that splitting tract persistence by time slot (weekday/
weekend x 4 time-of-day blocks) recovers real signal a flat tract-level
model misses -- but the neighborhood-context features (Census, alcohol
outlets) still barely moved the needle once slot-history was in the model.
The standard criminological explanation for a null result like that is
that it's pooling behaviors with different drivers into one target:
routine-activity theory says violent crime clusters around social/alcohol
contact points, while property crime follows opportunity and guardianship
(empty homes, unattended vehicles) -- averaging them together can cancel
out exactly the context effects each type has on its own.

This phase re-runs Phase 5F's tract x slot design separately for three
criminologically distinct, high-volume groups instead of one pooled model:
  - violent   (is_violent flag: assault, robbery, domestic violence, homicide, sex offense)
  - vehicle   (crime_category == "Vehicle Crime" -- already known to be a
               category apart: 194k incidents, 4.4% clearance, its own
               Key Finding -- kept separate from "property" rather than folded in)
  - property  (is_property flag, vehicle crime excluded -- burglary, theft,
               vandalism, arson)
"Other" (fraud, identity theft, misc) is excluded -- it's not the kind of
crime a spatial-temporal hotspot map is meant to guide patrol against.

Same reliable-data constraint, same BASELINE/TARGET windows, same tract x
slot panel construction as ml_hotspot_temporal.py. The one methodological
choice worth flagging: all three groups share the SAME 80/20 train/test
tract split (one draw, reused three times) so a hit-rate difference across
groups reflects the crime type, not which tracts happened to land in test.

Outputs (outputs/figures/): p5g_01_feature_importance_<group>.png, p5g_02_hitrate_comparison.png
Outputs (outputs/reports/): hotspot_crimetype_metrics.csv
Outputs (outputs/models/): hotspot_<group>_xgb.joblib
Outputs (dashboard/public/data/): hotspot_crimetype_model.json, hotspot_crimetype_tracts.geojson

Run: python src/ml_hotspot_crimetype.py
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

CRIME_GROUPS = {
    "violent":  {"label": "Violent Crime",  "col": "is_violent",      "val": True},
    "vehicle":  {"label": "Vehicle Crime",  "col": "crime_category",  "val": "Vehicle Crime"},
    "property": {"label": "Property Crime", "col": "is_property",     "val": True},
}

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
GREEN   = "#3ecf8e"
YELLOW  = "#e0c066"
RED     = "#e05252"
MUTED   = "#7b82a0"
GROUP_COLORS = {"violent": RED, "vehicle": YELLOW, "property": BLUE}

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
# 1. DENOMINATORS + SHARED GEOID GRID
# ══════════════════════════════════════════════════════════════════════════════

def slot_day_counts(start: pd.Timestamp, end: pd.Timestamp) -> dict:
    days = pd.date_range(start, end, freq="D")
    is_wknd = days.dayofweek.isin([5, 6])
    return {"weekend": int(is_wknd.sum()), "weekday": int((~is_wknd).sum())}


# ══════════════════════════════════════════════════════════════════════════════
# 2. BUILD ONE GROUP'S TRACT x SLOT PANEL
# ══════════════════════════════════════════════════════════════════════════════

def build_group_panel(df: pd.DataFrame, geoids: list, census: pd.DataFrame, alcohol: pd.DataFrame,
                       group_key: str, base_denom: dict, targ_denom: dict) -> pd.DataFrame:
    g = CRIME_GROUPS[group_key]
    gdf = df[df[g["col"]] == g["val"]]

    baseline = gdf[(gdf["date_occ"] >= BASELINE_START) & (gdf["date_occ"] <= BASELINE_END)]
    target   = gdf[(gdf["date_occ"] >= TARGET_START) & (gdf["date_occ"] <= RELIABLE_CUTOFF)]

    def slot_counts(frame):
        return frame.groupby(["GEOID", "day_type", "time_of_day"]).size().rename("n").reset_index()

    base_c = slot_counts(baseline).rename(columns={"n": "baseline_count"})
    targ_c = slot_counts(target).rename(columns={"n": "target_count"})

    grid = pd.DataFrame(
        [(gid, dt, tod) for gid in geoids for dt, tod in SLOTS],
        columns=["GEOID", "day_type", "time_of_day"],
    )
    panel = grid.merge(base_c, on=["GEOID", "day_type", "time_of_day"], how="left") \
                .merge(targ_c, on=["GEOID", "day_type", "time_of_day"], how="left")
    panel[["baseline_count", "target_count"]] = panel[["baseline_count", "target_count"]].fillna(0)

    panel["baseline_rate_slot"] = panel.apply(lambda r: r["baseline_count"] / base_denom[r["day_type"]], axis=1)
    panel["target_rate_slot"] = panel.apply(lambda r: r["target_count"] / targ_denom[r["day_type"]], axis=1)

    tract_base = panel.groupby("GEOID")["baseline_count"].sum() / sum(base_denom.values())
    panel["baseline_rate_tract"] = panel["GEOID"].map(tract_base)

    daytype_avg = panel.groupby(["GEOID", "day_type"])["baseline_rate_slot"].transform("mean")
    panel["slot_share"] = np.where(daytype_avg > 0, panel["baseline_rate_slot"] / daytype_avg, 0.0)
    panel["is_weekend"] = (panel["day_type"] == "weekend").astype(int)
    panel["slot_key"] = panel.apply(lambda r: SLOT_KEY[(r["day_type"], r["time_of_day"])], axis=1)

    panel = panel.merge(census, on="GEOID", how="left").merge(alcohol, on="GEOID", how="left")
    panel = panel.dropna(subset=["pop_total"])
    return panel


# ══════════════════════════════════════════════════════════════════════════════
# 3. MODEL (per group)
# ══════════════════════════════════════════════════════════════════════════════

def train_and_evaluate(panel: pd.DataFrame, test_tracts: set, group_key: str):
    X = panel[FEATURES].copy()
    for c in CAT_FEATURES:
        X[c] = X[c].astype(str).astype("category")
    for c in [f for f in FEATURES if f not in CAT_FEATURES]:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    y = panel["target_rate_slot"]

    is_test = panel["GEOID"].isin(test_tracts)
    X_train, X_test = X[~is_test], X[is_test]
    y_train, y_test = y[~is_test], y[is_test]

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
        if total_actual <= 0:
            return 0.0
        return test_df.nlargest(k, rank_col)["target_count"].sum() / total_actual

    metrics = {
        "group": group_key, "label": CRIME_GROUPS[group_key]["label"],
        "r2": round(r2, 4), "mae": round(mae, 4),
        "n_train": len(X_train), "n_test": len(X_test),
        "n_incidents_target": int(total_actual),
        "top_k_pct": TOP_K_PCT,
        "model_hit_rate": round(hit_rate("predicted_rate"), 4),
        "slot_persistence_hit_rate": round(hit_rate("baseline_rate_slot"), 4),
        "tract_persistence_hit_rate": round(hit_rate("baseline_rate_tract"), 4),
        "random_hit_rate": round(k / len(test_df), 4),
    }
    print(f"  [{group_key}] R²={metrics['r2']}  n_target_incidents={metrics['n_incidents_target']:,}")
    print(f"  [{group_key}] Hit@{TOP_K_PCT:.0%}: model={metrics['model_hit_rate']:.1%}  "
          f"slot={metrics['slot_persistence_hit_rate']:.1%}  tract={metrics['tract_persistence_hit_rate']:.1%}  "
          f"random={metrics['random_hit_rate']:.1%}")

    return model, metrics


# ══════════════════════════════════════════════════════════════════════════════
# 4. EXPORTS
# ══════════════════════════════════════════════════════════════════════════════

def score_full_panel(model, panel: pd.DataFrame) -> pd.DataFrame:
    X_all = panel[FEATURES].copy()
    for c in CAT_FEATURES:
        X_all[c] = X_all[c].astype(str).astype("category")
    for c in [f for f in FEATURES if f not in CAT_FEATURES]:
        X_all[c] = pd.to_numeric(X_all[c], errors="coerce")
    panel = panel.copy()
    panel["predicted_rate"] = np.clip(model.predict(X_all), 0, None)
    return panel


def export_map_geojson(scored: dict):
    """dashboard/public/data/hotspot_crimetype_tracts.geojson — one row per
    tract, pred_<group>_<slot> / hist_<group>_<slot> for all 3 groups x 8 slots."""
    merged = None
    for group_key, panel in scored.items():
        wide = panel.pivot_table(index="GEOID", columns="slot_key",
                                  values=["predicted_rate", "baseline_rate_slot"], aggfunc="first")
        wide.columns = [f"{'pred' if a == 'predicted_rate' else 'hist'}_{group_key}_{b}" for a, b in wide.columns]
        wide = wide.round(4).reset_index()
        merged = wide if merged is None else merged.merge(wide, on="GEOID", how="outer")

    any_panel = next(iter(scored.values()))
    overall = any_panel.groupby("GEOID").agg(pop_total=("pop_total", "first")).reset_index()
    merged = merged.merge(overall, on="GEOID", how="left")

    tracts = gpd.read_file(EXT / "census_tracts_la.geojson")[["GEOID", "geometry"]]
    out_gdf = tracts.merge(merged, on="GEOID", how="inner")

    out = DASH / "hotspot_crimetype_tracts.geojson"
    out_gdf.to_file(out, driver="GeoJSON")
    print(f"  Saved {len(out_gdf)} tracts x {len(CRIME_GROUPS)} groups x {len(SLOTS)} slots -> {out.relative_to(ROOT)}")


def export_dashboard_json(models: dict, metrics_by_group: dict):
    groups_payload = {}
    for group_key, model in models.items():
        imp = model.feature_importances_
        order = np.argsort(imp)[::-1]
        feature_importance = [
            {"feature": FEAT_LABELS.get(FEATURES[i], FEATURES[i]), "importance": round(float(imp[i] / imp[order[0]]), 4)}
            for i in order
        ]
        groups_payload[group_key] = {
            "label": CRIME_GROUPS[group_key]["label"],
            "metrics": metrics_by_group[group_key],
            "feature_importance": feature_importance,
        }

    payload = {
        "baseline_period": f"{BASELINE_START.strftime('%Y-%m')} to {BASELINE_END.strftime('%Y-%m')}",
        "target_period": f"{TARGET_START.strftime('%Y-%m')} to {RELIABLE_CUTOFF.strftime('%Y-%m')}",
        "groups": groups_payload,
    }
    out = DASH / "hotspot_crimetype_model.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"  Saved {out.relative_to(ROOT)}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. FIGURES
# ══════════════════════════════════════════════════════════════════════════════

def plot_feature_importance(model, metrics: dict, group_key: str):
    imp = model.feature_importances_
    idx = np.argsort(imp)[::-1]
    labs = [FEAT_LABELS.get(FEATURES[i], FEATURES[i]) for i in idx]
    vals = imp[idx] / imp[idx].max()

    fig, ax = plt.subplots(figsize=(9, 6), facecolor=BG)
    ax.set_facecolor(SURFACE)
    ax.barh(range(len(labs)), vals[::-1], color=GROUP_COLORS[group_key], alpha=0.85)
    ax.set_yticks(range(len(labs))); ax.set_yticklabels(labs[::-1], fontsize=10)
    ax.set_xlabel("Relative Importance")
    ax.set_title(f"Feature Importance — {metrics['label']}\nHit Rate@{metrics['top_k_pct']:.0%}={metrics['model_hit_rate']:.1%}",
                 color="white", fontsize=12, pad=10)
    ax.grid(True, alpha=0.3, axis="x")
    fig.tight_layout()
    plt.savefig(FIGDIR / f"p5g_01_feature_importance_{group_key}.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  Saved p5g_01_feature_importance_{group_key}.png")


def plot_hitrate_comparison(metrics_by_group: dict):
    groups = list(metrics_by_group.keys())
    methods = ["tract_persistence_hit_rate", "slot_persistence_hit_rate", "model_hit_rate"]
    method_labels = ["Flat tract (no time)", "Slot history (time, no model)", "Model (full)"]

    fig, ax = plt.subplots(figsize=(9, 5), facecolor=BG)
    ax.set_facecolor(SURFACE)
    x = np.arange(len(groups))
    width = 0.25
    colors = [MUTED, GREEN, BLUE]
    for i, (m, lab) in enumerate(zip(methods, method_labels)):
        vals = [metrics_by_group[g][m] * 100 for g in groups]
        bars = ax.bar(x + (i - 1) * width, vals, width, label=lab, color=colors[i], alpha=0.9)
        ax.bar_label(bars, fmt="%.1f%%", fontsize=8, color="white", padding=2)
    ax.set_xticks(x); ax.set_xticklabels([CRIME_GROUPS[g]["label"] for g in groups], fontsize=11)
    ax.set_ylabel("Hit Rate @ Top 20%")
    ax.set_title("Hit Rate by Crime Type — Does Context Matter More for Some Types?", color="white", fontsize=12, pad=10)
    ax.legend(fontsize=9, loc="upper right")
    ax.grid(True, alpha=0.3, axis="y")
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5g_02_hitrate_comparison.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5g_02_hitrate_comparison.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5G - Crime-Type x Temporal Hotspot Model")
    print("=" * 60 + "\n")

    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                          columns=["date_occ", "GEOID", "is_weekend", "time_of_day",
                                   "is_violent", "is_property", "crime_category"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df = df.dropna(subset=["GEOID", "time_of_day"])
    df["day_type"] = np.where(df["is_weekend"], "weekend", "weekday")

    base_denom = slot_day_counts(BASELINE_START, BASELINE_END)
    targ_denom = slot_day_counts(TARGET_START, RELIABLE_CUTOFF)

    geoids = sorted(set(df["GEOID"].dropna()))
    census = gpd.read_file(EXT / "census_tracts_la.geojson")[
        ["GEOID", "pop_total", "poverty_rate", "median_hh_income", "owner_occ_rate"]
    ]
    alcohol = gpd.read_file(DASH / "alcohol_density.geojson")[
        ["GEOID", "licenses_per_1000", "off_sale", "on_sale"]
    ]

    # One shared tract-level 80/20 split, reused across all three groups so a
    # hit-rate difference reflects the crime type, not which tracts landed in test.
    test_tracts = set(RNG.choice(geoids, size=int(len(geoids) * 0.20), replace=False))
    print(f"  {len(geoids)} tracts total, {len(test_tracts)} held out for test (shared across groups)\n")

    models, metrics_by_group, scored = {}, {}, {}
    for group_key in CRIME_GROUPS:
        print(f"[{CRIME_GROUPS[group_key]['label']}]")
        panel = build_group_panel(df, geoids, census, alcohol, group_key, base_denom, targ_denom)
        model, metrics = train_and_evaluate(panel, test_tracts, group_key)
        models[group_key] = model
        metrics_by_group[group_key] = metrics
        scored[group_key] = score_full_panel(model, panel)
        joblib.dump(model, MODDIR / f"hotspot_{group_key}_xgb.joblib")
        print()

    pd.DataFrame(list(metrics_by_group.values())).to_csv(REPDIR / "hotspot_crimetype_metrics.csv", index=False)
    print("  Saved hotspot_crimetype_metrics.csv")

    print("\n[Generating figures...]")
    for group_key in CRIME_GROUPS:
        plot_feature_importance(models[group_key], metrics_by_group[group_key], group_key)
    plot_hitrate_comparison(metrics_by_group)

    print("\n[Exporting dashboard JSON + GeoJSON...]")
    export_dashboard_json(models, metrics_by_group)
    export_map_geojson(scored)

    print("\n" + "=" * 60)
    print("  Phase 5G complete")
    for group_key, m in metrics_by_group.items():
        lift_slot  = m["model_hit_rate"] / m["slot_persistence_hit_rate"] - 1 if m["slot_persistence_hit_rate"] else 0
        lift_tract = m["model_hit_rate"] / m["tract_persistence_hit_rate"] - 1 if m["tract_persistence_hit_rate"] else 0
        print(f"    {m['label']:<16} model={m['model_hit_rate']:.1%}  "
              f"vs slot={m['slot_persistence_hit_rate']:.1%} ({'+' if lift_slot>=0 else ''}{lift_slot:.1%})  "
              f"vs tract={m['tract_persistence_hit_rate']:.1%} ({'+' if lift_tract>=0 else ''}{lift_tract:.1%})")
    print("=" * 60)


if __name__ == "__main__":
    main()
