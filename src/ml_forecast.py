"""
Phase 5B -- Time Series Forecasting (rebuilt 2026-07-13)

Predicts monthly citywide crime volume 12 months beyond the last
reliable month, using two models: Prophet with exogenous regressors,
and XGBoost with lag/rolling features. Both are backtested on held-out
months before producing the forward forecast.

CRITICAL DATA ISSUE (why this file was rewritten):
  The previous version trained on the full raw monthly series through
  Dec 2024 and produced a forecast that went NEGATIVE by May 2025.
  Root cause: the extract's date_rptd tops out at 2025-03-28, and the
  dataset's own reporting-lag field (days_to_report) means any month
  close to that snapshot date is still missing late-arriving reports.
  The monthly count is stable at 15-20k every month from 2020-01
  through 2024-03 -- then collapses to 4,697 by 2024-12, an
  impossible 77% drop with no real-world cause. This is a reporting-
  completeness artifact, not a crime trend, and training on it teaches
  the model a fake collapse that extrapolates into negative territory.

  Fix: RELIABLE_CUTOFF truncates the usable series at 2024-03 (51
  reliable months). Everything after is excluded from training AND
  evaluation -- there is no ground truth to validate against for that
  window anyway (the true final counts aren't in this snapshot).

Outputs (outputs/figures/):
  p5b_01_forecast_overall.png      Actual (reliable) + excluded tail + backtest fit + forward forecast
  p5b_02_forecast_components.png   Prophet trend/seasonality decomposition

Outputs (outputs/reports/):
  forecast_monthly.csv             12-month forward forecast (mean + CI), both models
  forecast_backtest_metrics.csv    MAE/RMSE/MAPE on the last 12 reliable months, both models

Outputs (outputs/models/):
  forecast_xgb.joblib

Run: python src/ml_forecast.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import json

import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import xgboost as xgb
from sklearn.metrics import mean_absolute_error, mean_squared_error

ROOT   = Path(__file__).parent.parent
PROC   = ROOT / "data" / "processed"
EXT    = ROOT / "data" / "external"
FIGDIR = ROOT / "outputs" / "figures"
REPDIR = ROOT / "outputs" / "reports"
MODDIR = ROOT / "outputs" / "models"
for d in (FIGDIR, REPDIR, MODDIR):
    d.mkdir(parents=True, exist_ok=True)

RELIABLE_CUTOFF = pd.Timestamp("2024-03-31")
TEST_MONTHS = 12  # held out from the end of the reliable window for backtesting
FORECAST_HORIZON = 12  # months forward beyond RELIABLE_CUTOFF

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
RED     = "#e05252"
GREEN   = "#3ecf8e"
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


# ══════════════════════════════════════════════════════════════════════════════
# 1. DATA LOADING
# ══════════════════════════════════════════════════════════════════════════════

def load_target() -> pd.DataFrame:
    """Monthly citywide crime count, full series (reliable + excluded tail)."""
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet", columns=["date_occ"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    monthly = (
        df.groupby(df["date_occ"].dt.to_period("M")).size()
        .rename("y").reset_index()
    )
    monthly["ds"] = monthly["date_occ"].dt.to_timestamp()
    return monthly[["ds", "y"]].sort_values("ds").reset_index(drop=True)


def load_exogenous() -> pd.DataFrame:
    """Monthly weather, unemployment, and 311 disorder-request totals (citywide)."""
    weather = pd.read_csv(EXT / "weather_la_2020_2024.csv", parse_dates=["date"])
    weather["ds"] = weather["date"].values.astype("datetime64[M]")
    weather_m = weather.groupby("ds").agg(
        temp_avg_f=("temp_avg_f", "mean"),
        precip_in=("precip_in", "sum"),
    ).reset_index()

    unemp = pd.read_csv(EXT / "unemployment_la_2020_2024.csv", parse_dates=["date"])
    unemp = unemp.rename(columns={"date": "ds"})[["ds", "unemp_rate_pct"]]

    req311 = pd.read_csv(EXT / "311_monthly_by_precinct.csv")
    req311["ds"] = pd.to_datetime(req311["month"] + "-01")
    req311_m = req311.groupby("ds")["n"].sum().rename("disorder_311").reset_index()

    exo = weather_m.merge(unemp, on="ds", how="outer").merge(req311_m, on="ds", how="outer")
    return exo.sort_values("ds").reset_index(drop=True)


# ══════════════════════════════════════════════════════════════════════════════
# 2. FEATURE ENGINEERING (for XGBoost)
# ══════════════════════════════════════════════════════════════════════════════

def build_features(panel: pd.DataFrame) -> pd.DataFrame:
    df = panel.copy().sort_values("ds").reset_index(drop=True)
    df["month_num"] = df["ds"].dt.month
    df["month_sin"] = np.sin(2 * np.pi * df["month_num"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month_num"] / 12)
    df["trend_idx"] = np.arange(len(df))

    for lag in (1, 2, 3, 12):
        df[f"lag_{lag}"] = df["y"].shift(lag)
    df["roll3_mean"] = df["y"].shift(1).rolling(3).mean()
    return df


FEATURES = [
    "month_sin", "month_cos", "trend_idx",
    "lag_1", "lag_2", "lag_3", "lag_12", "roll3_mean",
    "temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311",
]


# ══════════════════════════════════════════════════════════════════════════════
# 3. BACKTEST — last TEST_MONTHS of the reliable window
# ══════════════════════════════════════════════════════════════════════════════

def backtest_xgb(feat: pd.DataFrame):
    usable = feat.dropna(subset=FEATURES + ["y"]).reset_index(drop=True)
    train, test = usable.iloc[:-TEST_MONTHS], usable.iloc[-TEST_MONTHS:]

    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, random_state=42,
    )
    model.fit(train[FEATURES], train["y"])
    pred = model.predict(test[FEATURES])

    mae  = mean_absolute_error(test["y"], pred)
    rmse = np.sqrt(mean_squared_error(test["y"], pred))
    mape = (np.abs(test["y"] - pred) / test["y"]).mean() * 100
    return {"model": "XGBoost", "mae": round(mae, 1), "rmse": round(rmse, 1), "mape": round(mape, 2)}, model, test.assign(yhat=pred)


def backtest_prophet(panel: pd.DataFrame, exo: pd.DataFrame):
    from prophet import Prophet

    reliable = panel[panel["ds"] <= RELIABLE_CUTOFF].reset_index(drop=True)
    train, test = reliable.iloc[:-TEST_MONTHS], reliable.iloc[-TEST_MONTHS:]

    train_m = train.merge(exo, on="ds", how="left")
    test_m  = test.merge(exo, on="ds", how="left")

    m = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False,
                seasonality_mode="additive", changepoint_prior_scale=0.05, interval_width=0.90)
    for reg in ["temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]:
        m.add_regressor(reg)
    m.fit(train_m[["ds", "y"] + ["temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]])

    fc = m.predict(test_m[["ds", "temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]])
    pred = fc["yhat"].values

    mae  = mean_absolute_error(test["y"], pred)
    rmse = np.sqrt(mean_squared_error(test["y"], pred))
    mape = (np.abs(test["y"].values - pred) / test["y"].values).mean() * 100
    return {"model": "Prophet", "mae": round(mae, 1), "rmse": round(rmse, 1), "mape": round(mape, 2)}, m, test.assign(yhat=pred)


# ══════════════════════════════════════════════════════════════════════════════
# 4. FORWARD FORECAST — FORECAST_HORIZON months beyond RELIABLE_CUTOFF
# ══════════════════════════════════════════════════════════════════════════════

def future_exogenous(exo: pd.DataFrame, start: pd.Timestamp, periods: int) -> pd.DataFrame:
    """
    Beyond the data's own known range, weather/unemployment/311 aren't known
    either. Weather uses historical monthly climatology (same-month average
    across all reliable years); unemployment and 311 carry forward their
    last known 12-month average (both are slow-moving relative to a 1-year
    horizon).
    """
    future_dates = pd.date_range(start, periods=periods, freq="MS")
    clim = exo.assign(month_num=exo["ds"].dt.month).groupby("month_num").agg(
        temp_avg_f=("temp_avg_f", "mean"), precip_in=("precip_in", "mean")
    )
    last12 = exo[exo["ds"] <= RELIABLE_CUTOFF].tail(12)
    fut = pd.DataFrame({"ds": future_dates})
    fut["month_num"] = fut["ds"].dt.month
    fut = fut.merge(clim, on="month_num", how="left").drop(columns="month_num")
    fut["unemp_rate_pct"] = last12["unemp_rate_pct"].mean()
    fut["disorder_311"]   = last12["disorder_311"].mean()
    return fut


def forecast_forward_xgb(model, panel: pd.DataFrame, exo: pd.DataFrame):
    reliable = panel[panel["ds"] <= RELIABLE_CUTOFF].reset_index(drop=True)
    fut_exo = future_exogenous(exo, RELIABLE_CUTOFF + pd.offsets.MonthBegin(1), FORECAST_HORIZON)

    history = reliable.merge(exo, on="ds", how="left").copy()
    preds = []
    for _, row in fut_exo.iterrows():
        recent = history["y"].tolist()
        feat_row = {
            "month_sin": np.sin(2 * np.pi * row["ds"].month / 12),
            "month_cos": np.cos(2 * np.pi * row["ds"].month / 12),
            "trend_idx": len(history),
            "lag_1": recent[-1], "lag_2": recent[-2], "lag_3": recent[-3], "lag_12": recent[-12],
            "roll3_mean": np.mean(recent[-3:]),
            "temp_avg_f": row["temp_avg_f"], "precip_in": row["precip_in"],
            "unemp_rate_pct": row["unemp_rate_pct"], "disorder_311": row["disorder_311"],
        }
        yhat = model.predict(pd.DataFrame([feat_row])[FEATURES])[0]
        preds.append(yhat)
        history = pd.concat([history, pd.DataFrame([{**row.to_dict(), "y": yhat}])], ignore_index=True)

    return pd.DataFrame({"ds": fut_exo["ds"], "yhat": preds})


def forecast_forward_prophet(model, exo: pd.DataFrame):
    fut_exo = future_exogenous(exo, RELIABLE_CUTOFF + pd.offsets.MonthBegin(1), FORECAST_HORIZON)
    fc = model.predict(fut_exo[["ds", "temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]])
    return fc[["ds", "yhat", "yhat_lower", "yhat_upper"]]


# ══════════════════════════════════════════════════════════════════════════════
# 5. PLOT
# ══════════════════════════════════════════════════════════════════════════════

def plot_forecast(panel: pd.DataFrame, backtest_xgb_df: pd.DataFrame, backtest_prophet_df: pd.DataFrame,
                   fwd_xgb: pd.DataFrame, fwd_prophet: pd.DataFrame):
    reliable = panel[panel["ds"] <= RELIABLE_CUTOFF]
    excluded = panel[panel["ds"] > RELIABLE_CUTOFF]

    fig, ax = plt.subplots(figsize=(14, 6.5), facecolor=BG)
    ax.set_facecolor(SURFACE)

    ax.plot(reliable["ds"], reliable["y"], color=BLUE, lw=2, label="Actual (reliable, 2020-01 to 2024-03)", zorder=5)
    ax.plot(excluded["ds"], excluded["y"], color=MUTED, lw=1.5, ls=":", label="Excluded (reporting-incomplete)", zorder=3)

    ax.plot(backtest_xgb_df["ds"], backtest_xgb_df["yhat"], color=YELLOW, lw=1.8, marker="o", ms=4,
            label=f"XGBoost backtest (last {TEST_MONTHS}mo)", zorder=6)
    ax.plot(backtest_prophet_df["ds"], backtest_prophet_df["yhat"], color=PURPLE, lw=1.8, marker="s", ms=4,
            label=f"Prophet backtest (last {TEST_MONTHS}mo)", zorder=6)

    ax.plot(fwd_xgb["ds"], fwd_xgb["yhat"], color=GREEN, lw=2.2, marker="o", ms=4, label="XGBoost forward forecast", zorder=7)
    ax.plot(fwd_prophet["ds"], fwd_prophet["yhat"], color=RED, lw=2.2, marker="s", ms=4, label="Prophet forward forecast", zorder=7)
    ax.fill_between(fwd_prophet["ds"], fwd_prophet["yhat_lower"], fwd_prophet["yhat_upper"],
                     color=RED, alpha=0.15, label="Prophet 90% CI")

    ax.axvline(RELIABLE_CUTOFF, color="white", lw=1, ls="--", alpha=0.6)
    ax.text(RELIABLE_CUTOFF, ax.get_ylim()[1], " reliable data ends ", color="white", fontsize=8, va="top", ha="left", alpha=0.7)

    ax.set_xlabel("Month")
    ax.set_ylabel("Monthly Crime Count (citywide)")
    ax.set_title("LAPD Monthly Crime Forecast — XGBoost vs Prophet", fontsize=14, color="white", pad=12)
    ax.legend(fontsize=8, loc="upper left", ncol=2)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    plt.savefig(FIGDIR / "p5b_01_forecast_overall.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5b_01_forecast_overall.png")


def export_dashboard_json(panel: pd.DataFrame, xgb_test: pd.DataFrame, prophet_test: pd.DataFrame,
                           fwd_xgb: pd.DataFrame, fwd_prophet: pd.DataFrame,
                           xgb_metrics: dict, prophet_metrics: dict):
    """dashboard/public/data/crime_forecast.json -- one row per month, history + forecast."""
    rows = []
    for _, r in panel.iterrows():
        rows.append({
            "month": r["ds"].strftime("%Y-%m"),
            "actual": int(r["y"]),
            "reliable": bool(r["ds"] <= RELIABLE_CUTOFF),
        })
    by_month = {r["month"]: r for r in rows}

    for _, r in xgb_test.iterrows():
        by_month[r["ds"].strftime("%Y-%m")]["xgb_backtest"] = round(float(r["yhat"]))
    for _, r in prophet_test.iterrows():
        by_month[r["ds"].strftime("%Y-%m")]["prophet_backtest"] = round(float(r["yhat"]))

    def upsert(month: str, fields: dict):
        if month in by_month:
            by_month[month].update(fields)
        else:
            row = {"month": month, **fields}
            rows.append(row)
            by_month[month] = row

    for _, r in fwd_xgb.iterrows():
        upsert(r["ds"].strftime("%Y-%m"), {"xgb_forecast": round(float(r["yhat"]))})
    for _, r in fwd_prophet.iterrows():
        upsert(r["ds"].strftime("%Y-%m"), {
            "prophet_forecast": round(float(r["yhat"])),
            "prophet_ci_lower": round(float(r["yhat_lower"])),
            "prophet_ci_upper": round(float(r["yhat_upper"])),
        })
    rows.sort(key=lambda r: r["month"])

    payload = {
        "reliable_cutoff": RELIABLE_CUTOFF.strftime("%Y-%m"),
        "excluded_reason": "Months after the reliable cutoff are undercounted due to reporting lag "
                            "(the source extract's date_rptd tops out at 2025-03-28, so recent "
                            "date_occ months haven't finished accumulating late-arriving reports) "
                            "-- not a real drop in crime. Excluded from both training and evaluation.",
        "backtest_metrics": [xgb_metrics, prophet_metrics],
        "series": rows,
    }

    out = ROOT / "dashboard" / "public" / "data" / "crime_forecast.json"
    out.write_text(json.dumps(payload), encoding="utf-8")
    print(f"  Saved {out.relative_to(ROOT)}")


def plot_components(prophet_model):
    fig = prophet_model.plot_components(prophet_model.predict(prophet_model.history))
    fig.set_facecolor(BG)
    for ax in fig.axes:
        ax.set_facecolor(SURFACE)
        ax.tick_params(colors=MUTED)
        ax.xaxis.label.set_color("white")
        ax.yaxis.label.set_color("white")
        ax.title.set_color("white")
    plt.savefig(FIGDIR / "p5b_02_forecast_components.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print("  Saved p5b_02_forecast_components.png")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5B - Time Series Forecasting")
    print("=" * 60 + "\n")

    panel = load_target()
    exo = load_exogenous()
    n_reliable = (panel["ds"] <= RELIABLE_CUTOFF).sum()
    n_excluded = (panel["ds"] > RELIABLE_CUTOFF).sum()
    print(f"  {len(panel)} total months | {n_reliable} reliable | {n_excluded} excluded (reporting-incomplete, see module docstring)")

    full_panel = panel.merge(exo, on="ds", how="left")
    feat = build_features(full_panel[full_panel["ds"] <= RELIABLE_CUTOFF])

    print("\n[1] Backtesting XGBoost...")
    xgb_metrics, xgb_model, xgb_test = backtest_xgb(feat)
    print(f"    MAE={xgb_metrics['mae']}  RMSE={xgb_metrics['rmse']}  MAPE={xgb_metrics['mape']}%")

    print("\n[2] Backtesting Prophet...")
    prophet_metrics, prophet_model, prophet_test = backtest_prophet(panel, exo)
    print(f"    MAE={prophet_metrics['mae']}  RMSE={prophet_metrics['rmse']}  MAPE={prophet_metrics['mape']}%")

    pd.DataFrame([xgb_metrics, prophet_metrics]).to_csv(REPDIR / "forecast_backtest_metrics.csv", index=False)
    print(f"\n  Saved forecast_backtest_metrics.csv")

    print("\n[3] Forward forecast (XGBoost)...")
    full_feat_reliable = build_features(full_panel[full_panel["ds"] <= RELIABLE_CUTOFF]).dropna(subset=FEATURES)
    xgb_final = xgb.XGBRegressor(n_estimators=300, max_depth=3, learning_rate=0.05,
                                  subsample=0.8, colsample_bytree=0.8, random_state=42)
    xgb_final.fit(full_feat_reliable[FEATURES], full_feat_reliable["y"])
    fwd_xgb = forecast_forward_xgb(xgb_final, panel, exo)

    print("[4] Forward forecast (Prophet)...")
    reliable_m = panel[panel["ds"] <= RELIABLE_CUTOFF].merge(exo, on="ds", how="left")
    from prophet import Prophet
    prophet_final = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False,
                             seasonality_mode="additive", changepoint_prior_scale=0.05, interval_width=0.90)
    for reg in ["temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]:
        prophet_final.add_regressor(reg)
    prophet_final.fit(reliable_m[["ds", "y", "temp_avg_f", "precip_in", "unemp_rate_pct", "disorder_311"]])
    fwd_prophet = forecast_forward_prophet(prophet_final, exo)

    print("\n[5] Plotting...")
    plot_forecast(panel, xgb_test, prophet_test, fwd_xgb, fwd_prophet)
    plot_components(prophet_final)

    out = fwd_xgb.rename(columns={"yhat": "xgb_forecast"}).merge(
        fwd_prophet.rename(columns={"yhat": "prophet_forecast", "yhat_lower": "prophet_ci_lower", "yhat_upper": "prophet_ci_upper"}),
        on="ds"
    )
    out["month"] = out["ds"].dt.strftime("%Y-%m")
    out = out[["month", "xgb_forecast", "prophet_forecast", "prophet_ci_lower", "prophet_ci_upper"]].round(0)
    out.to_csv(REPDIR / "forecast_monthly.csv", index=False)
    print(f"\n  Saved forecast_monthly.csv ({len(out)} months, {out['month'].iloc[0]} to {out['month'].iloc[-1]})")

    joblib.dump(xgb_final, MODDIR / "forecast_xgb.joblib")
    print(f"  Saved forecast_xgb.joblib")

    print("\n[6] Exporting dashboard JSON...")
    export_dashboard_json(panel, xgb_test, prophet_test, fwd_xgb, fwd_prophet, xgb_metrics, prophet_metrics)

    print("\n" + "=" * 60)
    winner = "XGBoost" if xgb_metrics["mape"] < prophet_metrics["mape"] else "Prophet"
    print(f"  Phase 5B complete — better backtest MAPE: {winner}")
    print("=" * 60)


if __name__ == "__main__":
    main()
